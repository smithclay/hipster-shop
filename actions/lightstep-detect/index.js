const core = require('@actions/core');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const lightstepSdk = require('lightstep-js-sdk');
const LIGHTSTEP_CONFIG_FILE = process.env.LIGHTSTEP_CONFIG_FILE || '.lightstep.yml';

function configExists() {
    return fs.existsSync(path.join(process.env.GITHUB_WORKSPACE, LIGHTSTEP_CONFIG_FILE));
}

function loadConfig() {
    try {
        let fileContents = fs.readFileSync(path.join(process.env.GITHUB_WORKSPACE, LIGHTSTEP_CONFIG_FILE), 'utf8');
        return yaml.safeLoadAll(fileContents);
    } catch (e) {
        return null;
    }
}

async function run() {
    try {
        // Get the JSON webhook payload for the event that triggered the workflow
        // const payload = JSON.stringify(github.context.payload, undefined, 2)

        if (configExists()) {
            const config = loadConfig();
            console.dir(config)
            const lightstepOrg = process.env.LIGHTSTEP_ORG || (config[0] && config[0].organization);
            if (!lightstepOrg) {
                core.setFailed('Lightstep organization not found in config file or env variable.');
                return;
            }
            
            core.setOutput('lightstep_config', config[0]);

            const lightstepProj = process.env.LIGHTSTEP_PROJECT || process.env.LIGHTSTEP_PROJ || (config[0] && config[0].project);
            const apiClient = await lightstepSdk.init(lightstepOrg, process.env.LIGHTSTEP_API_TOKEN);

            // Associate with project
            console.log(`Fetching projects for ${lightstepOrg}...`);
            const projectsResponse = await apiClient.sdk.apis.Projects.listProjectsID({ organization: lightstepOrg });
            
            const foundProject = projectsResponse.body.data.find(p => {
                return p.id === lightstepProj;
            });
            
            core.setOutput('lightstep_org', lightstepOrg);
            core.exportVariable('LIGHTSTEP_ORG', lightstepOrg)
            if (foundProject) {
                core.setOutput('lightstep_project', foundProject.id);
                core.exportVariable('LIGHTSTEP_PROJ', foundProject.id)
            } else {
                core.setOutput('lightstep_project_missing', true);
                return;
            }

            // Associate with services
            console.log(`Fetching services for ${foundProject.id}...`);
            const servicesResponse = await apiClient.sdk.apis.Services.listServicesID({ organization: lightstepOrg, project: foundProject.id });
            const lightstepServices = servicesResponse.body.data.items.map( i => i.attributes.name );
            const configServices = config[0] && config[0].services;
            const configServiceNames = Object.keys(configServices);
            const repoServices = lightstepServices.filter(s => configServiceNames.includes(s));
            core.setOutput('lightstep_services', repoServices);

            // Detect changed services found in project based on git changes
            if (process.env.LIGHTSTEP_CHANGED_DIRS) {
                const changedDirs = process.env.LIGHTSTEP_CHANGED_DIRS.split(' ');
                const changedServices = repoServices
                    .filter(s => changedDirs.includes(configServices[s].path));
                core.setOutput('lightstep_services_changed', changedServices);
            } else {
                console.log('No changed directories detected.')
            }

        } else {
            core.exportVariable('LIGHTSTEP_CONFIG_MISSING', 1);
            //core.setFailed('Lightstep config does not exist.')
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

if (!process.env.LIGHTSTEP_API_TOKEN) {
    core.setFailed('env LIGHTSTEP_API_TOKEN must be set');
    return;
}

run();

