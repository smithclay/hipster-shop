const core = require('@actions/core');

const lightstepSdk = require('lightstep-js-sdk');


async function run() {
    try {
      const lightstepOrg = process.env.LIGHTSTEP_ORG;
      const lightstepProj = process.env.LIGHTSTEP_PROJECT || process.env.LIGHTSTEP_PROJ;
      const lightstepService = process.env.LIGHTSTEP_SERVICE;

      const apiClient = await lightstepSdk.init(lightstepOrg, process.env.LIGHTSTEP_API_TOKEN);
      console.log(`Creating snapshot for project ${lightstepProj}...`);
      const newSnapshot = await apiClient.sdk.apis.Snapshots.createSnapshot({ 
        organization: lightstepOrg, 
        project: lightstepProj, 
        data: { 
          data: {
            attributes: { 
              query: `service IN ("${lightstepService}")` 
            }
          } 
        }
      });

      core.setOutput('lightstep_snapshot_id', newSnapshot.body.data.id);
    } catch (error) {
        core.setFailed(error.message);
    }
}

if (!process.env.LIGHTSTEP_API_TOKEN) {
    core.setFailed('env LIGHTSTEP_API_TOKEN must be set');
    return;
}

run();
