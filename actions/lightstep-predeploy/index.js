const core = require('@actions/core')

//const lightstepSdk = require('lightstep-js-sdk')
const path = require('path')
const fs = require('fs')
const template = require('lodash.template')
const config = require('./config')

const tmplFile = fs.readFileSync(path.resolve('./pr.tmpl.md'), 'utf8')
const prTemplate = template(tmplFile)

const lightstepContext = require('./context/lightstep')
const rollbarContext = require('./context/rollbar')

function trafficLightStatus(s) {
    switch (s) {
    case "unknown":
        return ":white_circle:"
    case "error":
        return ":red_circle:"
    case "ok":
        return ":green_circle:"
    }
}

async function run() {
    try {
        const { lightstepOrg, lightstepProj, integrations } = config.loadConfig()

        if (!lightstepOrg) {
            core.setFailed('env LIGHTSTEP_ORG must be set or specified in .lightstep.yml')
            return
        }

        if (!lightstepProj) {
            core.setFailed('env LIGHTSTEP_PROJ must be set or specified in .lightstep.yml')
            return
        }

        const lightstepToken = process.env.LIGHTSTEP_API_TOKEN
        var templateContext = { trafficLightStatus }
        templateContext.lightstep = await lightstepContext.getSummary({ lightstepOrg, lightstepProj, lightstepToken })

        if (integrations.rollbar) {
            const token = process.env.ROLLBAR_API_TOKEN
            templateContext.rollbar = await rollbarContext.getSummary({ token, ...integrations.rollbar})
        }
        const markdown = prTemplate(templateContext)
        core.setOutput('lightstep_predeploy_md', markdown)
    } catch (error) {
        core.info(error)
        core.setFailed(error.message)
    }
}

if (!process.env.LIGHTSTEP_API_TOKEN) {
    core.setFailed('env LIGHTSTEP_API_TOKEN must be set')
    return
}

run()
