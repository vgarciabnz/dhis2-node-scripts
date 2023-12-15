import Utils from "./utils.js";
import fs from "fs";
import DHIS2HttpClient from "./dhis_http_client.js";

export default class CloneTeiJob {

    logFile = "mappings/mapping_tracked_entities.json";

    uniqueAttributeIds = ["qf4LouTknAe", "wbtl3uN0spv"];

    constructor(
        user,
        instances,
        mappingFile,
        trackedEntityUids
    ) {
        this.user = user;
        this.instances = instances;

        this.mappings = Utils.readAndParseFile(mappingFile);

        this.trackedEntityUids = trackedEntityUids;
    }

    async doWork() {
        fs.writeFileSync(this.logFile, "[]");

        for (let instance of this.instances) {
            const httpClient = new DHIS2HttpClient(instance.url, this.user);

            for (let id = instance.from; id <= instance.to; id++) {
                const userConfig = this.mappings.find(m => m.userIdx === id);
                await this.copyTeis(httpClient, userConfig);
            }
        }
    }

    async copyTeis(httpClient, userConfig) {
        const teiMappings = {};
        for (let trackedEntityUid of this.trackedEntityUids) {
            console.log(`Importing for user ${userConfig.userIdx} - TEI ${trackedEntityUid} (${userConfig.url})`);

            const trackedEntity = await httpClient
                .get(`tracker/trackedEntities/${trackedEntityUid}.json?fields=:all,enrollments[:all,events[:all]]`)
                .then(r => r.json());


            const newTeiUid = (await httpClient.getIds(1))[0];

            teiMappings[trackedEntity.trackedEntity] = newTeiUid;
            trackedEntity.trackedEntity = newTeiUid;
            delete trackedEntity.relationships;
            delete trackedEntity.programOwners;

            trackedEntity.attributes.forEach(attributeValue => {
                this.modifyAttributesIfNeeded(attributeValue, userConfig);
            });

            for (let enrollment of trackedEntity.enrollments) {
                delete enrollment.trackedEntity;
                delete enrollment.enrollment;
                delete enrollment.relationships;
                delete enrollment.geometry;

                enrollment.program = userConfig.mapping.programs[enrollment.program];

                enrollment.attributes.forEach(attributeValue => {
                    this.modifyAttributesIfNeeded(attributeValue, userConfig);
                });

                for (let event of enrollment.events) {
                    delete event.trackedEntity;
                    delete event.enrollment;
                    delete event.event;
                    delete event.relationships;

                    event.program = userConfig.mapping.programs[event.program];
                    event.programStage = userConfig.mapping.programStages[event.programStage];

                    event.dataValues.forEach(dataValue => {
                        dataValue.dataElement = userConfig.mapping.dataElements[dataValue.dataElement]
                    });

                    event.dataValues = event.dataValues.filter(dataValue => dataValue.dataElement !== undefined && dataValue.dataElement !== "");
                }
            }

            const mode = "COMMIT";
            const response = await httpClient
                .post(`tracker?importMode=${mode}&async=false&skipRuleEngine=true`, { "trackedEntities": [trackedEntity] })
                .then(r => r.json());

            console.log("Import result " + response.status);
        }

        this.appendToLogFile(userConfig, teiMappings);
    }

    modifyAttributesIfNeeded(attributeValue, userConfig) {
        if (this.uniqueAttributeIds.includes(attributeValue.attribute)) {
            attributeValue.value = attributeValue.value + "User" + userConfig.userIdx;
        }
    }

    appendToLogFile(userConfig, teiMapping) {
        const existingContent = fs.readFileSync(this.logFile, "utf-8");
        const existingMapping = JSON.parse(existingContent);

        const newTrackedEntityMapping = existingMapping.concat({
            "url": userConfig.url,
            "userIdx": userConfig.userIdx,
            "trackedEntities": teiMapping
        });

        fs.writeFileSync(this.logFile, JSON.stringify(newTrackedEntityMapping, null, 2));
    }
}
