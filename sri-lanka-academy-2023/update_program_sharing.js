import DHIS2HttpClient from "./dhis_http_client.js";
import Utils from "./utils.js";

export default class UpdateProgramSharing {
    constructor(
        user,
        instances,
        mappingFile
    ) {
        this.user = user;
        this.instances = instances;
        this.mappings = Utils.readAndParseFile(mappingFile);
    }

    async doWork() {
        for (let instance of this.instances) {
            const httpClient = new DHIS2HttpClient(instance.url, this.user);

            for (let id = instance.from; id <= instance.to; id++) {
                const userConfig = this.mappings.find(m => m.userIdx === id);
                await this.resetTrackedEntityType(httpClient, userConfig);
            }
        }
    }

    async resetTrackedEntityType(httpClient, userConfig) {
        const programMapping = userConfig.mapping.programs;

        for (let oldProgram in programMapping) {
            const newProgramId = programMapping[oldProgram];

            const program = await httpClient.get(`programs/${newProgramId}.json?fields=:all,!relatedProgram`).then(r => r.json());

            console.log(`Updating tracked entity type for user ${userConfig.userIdx} (${userConfig.url}) - program ${newProgramId}`);

            program.trackedEntityType = {
                "id": "r0eu7nkzXSF"
            }

            const importMode = "COMMIT";
            await httpClient.postToMetadata({"programs": [program]}, importMode);
        }
    }

    async updateProgramSharing(httpClient, userConfig) {
        const programMapping = userConfig.mapping.programs;

        for (let oldProgram in programMapping) {
            const newProgramId = programMapping[oldProgram];

            const program = await httpClient.get(`programs/${newProgramId}.json?fields=:all,!relatedProgram`).then(r => r.json());

            console.log(`Updating sharing settings for user ${userConfig.userIdx} (${userConfig.url}) - program ${newProgramId}`);

            program.userAccesses.forEach(access => {
                if (access.id === userConfig.adminUserId) {
                    access.access = "rwrw----";
                }
            })

            delete program.relatedProgram;

            const importMode = "COMMIT";
            await httpClient.postToMetadata({"programs": [program]}, importMode);
        }

        for (let oldProgramStage in userConfig.mapping.programStages) {
            const newProgramStageId = userConfig.mapping.programStages[oldProgramStage];

            const programStage = await httpClient.get(`programStages/${newProgramStageId}.json`).then(r => r.json());

            programStage.userAccesses.forEach(access => {
                if (access.id === userConfig.adminUserId) {
                    access.access = "rwrw----";
                }
            });

            const importMode = "COMMIT";
            await httpClient.postToMetadata({"programStages": [programStage]}, importMode);
        }
    }
}
