import DHIS2HttpClient from "./dhis_http_client.js";
import Utils from "./utils.js";

export default class RemoveProgramIndicatorRules {
    constructor(
        user,
        instances,
        mappingFile,
        programIndicators,
        programRules,
        programRuleVariables
    ) {
        this.user = user;
        this.instances = instances;
        this.mappings = Utils.readAndParseFile(mappingFile);

        this.programIndicators = programIndicators;
        this.programRules = programRules;
        this.programRuleVariables = programRuleVariables;
    }

    async doWork() {
        for (let instance of this.instances) {
            const httpClient = new DHIS2HttpClient(instance.url, this.user);

            for (let id = instance.from; id <= instance.to; id++) {
                const userConfig = this.mappings.find(m => m.userIdx === id);
                await this.removeData(httpClient, userConfig);
            }
        }
    }

    async removeData(httpClient, userConfig) {
        console.log(`Removing data for user ${userConfig.userIdx} (${userConfig.url})`)

        for (let baseProgramRule of this.programRules) {
            const programRuleId = userConfig.mapping.programRules[baseProgramRule];
            await this.removeProgramRule(httpClient, programRuleId);
        }

        for (let baseProgramRuleVariable of this.programRuleVariables) {
            const programRuleVariableId = userConfig.mapping.programRuleVariables[baseProgramRuleVariable];
            await this.removeProgramRuleVariables(httpClient, programRuleVariableId);
        }

        for (let baseProgarmIndicatorId of this.programIndicators) {
            const programIndicatorId = userConfig.mapping.programIndicators[baseProgarmIndicatorId];
            await this.removeProgramIndicator(httpClient, programIndicatorId);
        }
    }

    async removeProgramIndicator(httpClient, programIndicatorId) {
        const programIndicator = await httpClient.get(`programIndicators/${programIndicatorId}.json`).then(r => r.json());

        programIndicator.userAccesses.forEach(access => {
            access.access = access.access.substring(0, 2) + "------";
        });

        await httpClient.postToMetadata({ "programIndicators": [programIndicator]});

        await httpClient.delete(`programIndicators/${programIndicatorId}`);
    }

    async removeProgramRule(httpClient, programRuleId) {
        await httpClient.delete(`programRules/${programRuleId}`);
    }

    async removeProgramRuleVariables(httpClient, programRuleVariableId) {
        await httpClient.delete(`programRuleVariables/${programRuleVariableId}`);

    }
}
