const core = require('@actions/core');

const lightstepSdk = require('lightstep-js-sdk');
const path = require('path');
const fs = require('fs');
var template = require('lodash.template');

const tmplFile = fs.readFileSync(path.resolve('./pr.tmpl.md'), 'utf8')
const prTemplate = template(tmplFile)

async function run() {
  try {
    const lightstepOrg = process.env.LIGHTSTEP_ORG;
    const lightstepProj = process.env.LIGHTSTEP_PROJECT || process.env.LIGHTSTEP_PROJ;

    const apiClient = await lightstepSdk.init(lightstepOrg, process.env.LIGHTSTEP_API_TOKEN);

    const conditionsResponse = await apiClient.sdk.apis.Conditions.listConditionsID({
      organization: lightstepOrg,
      project: lightstepProj
    })
    const conditionIds = conditionsResponse.body.data.map(c => c.id)
    const conditionStatusPromises = conditionIds.map(id => apiClient.sdk.apis.Conditions.getConditionStatusID({
      'condition-id': id,
      organization: lightstepOrg,
      project: lightstepProj
    })
    )
    const conditionStatusResponses = await Promise.all(conditionStatusPromises)
    const conditionStatuses = conditionStatusResponses.map(s => {
      const cleanId = s.body.data.id.replace('-status', '');
      return { 
        id: cleanId, 
        name: conditionsResponse.body.data.find(s => s.id === cleanId).attributes.name,
        state: s.body.data.attributes.state 
      }
    })
    const markdown = prTemplate({
      project: lightstepProj,
      conditions: conditionStatuses
    })
    core.setOutput('lightstep_conditions_md', markdown);
    core.setOutput('lightstep_conditions', JSON.stringify(conditionStatuses));
  } catch (error) {
    core.setFailed(error.message);
  }
}

if (!process.env.LIGHTSTEP_API_TOKEN) {
  core.setFailed('env LIGHTSTEP_API_TOKEN must be set');
  return;
}

if (!process.env.LIGHTSTEP_ORG) {
  core.setFailed('env LIGHTSTEP_ORG must be set');
  return;
}

if (!process.env.LIGHTSTEP_PROJ) {
  core.setFailed('env LIGHTSTEP_PROJ must be set');
  return;
}

run();
