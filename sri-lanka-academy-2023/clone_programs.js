import fetch from 'node-fetch';
import * as fs from 'fs';

const user = {
    username: "admin",
    password: "district"
}

const superAdminUserId = "M5zQapPyTZI";
const superAdminGroupId = "pey6425xXt5";
const baseAndroidUserId = "zGnHx4TUCTM";
const baseAdminUserId = "sH7G8eVjHfc";
const userFields = "name,username,surname,firstName,organisationUnits,teiSearchOrganisationUnits,id,userRoles,userGroups";

const baseProgramId = "SSLpOM0r1U7" // Immunization

const programRuleToDelete = [
    "rhispzm1059",  // There is an error in the metadata
    "q7JTl3XcJ75"   // Temp > 37 (for exercise)
];

const usersFilePath = "users.csv";
const mappingFile = "mapping.json";

async function main() {
    const instances = [
        {url: "http://localhost:8080", from: 100, to: 115},
        {url: "http://localhost:8080", from: 116, to: 130},
    ];

    fs.writeFileSync(usersFilePath, "");
    fs.writeFileSync(mappingFile, "[]");

    for (let instance of instances) {
        const cloneMetadataInstance = new CloneMetadataInstance(instance.url);
        await cloneMetadataInstance.cloneMetadata(instance.from, instance.to);
    }
}

class CloneMetadataInstance {

    url;

    constructor(url) {
        this.url = url;
    }

    async cloneMetadata(fromIdx, toIdx) {
        // Download base metadata (user, program)
        const baseAndroidUser = await (await this.get(`users/${baseAndroidUserId}?fields=${userFields}`)).json();
        const baseAdminUser = await (await this.get(`users/${baseAdminUserId}?fields=${userFields}`)).json();

        const baseProgramMetadata = await (await this.get(`programs/${baseProgramId}/metadata`)).json();

        for (let id = fromIdx; id <= toIdx; id++) {
            // Clone the users
            console.log(`Starting cloning process for user ${id} in instance '${this.url}'`);

            const password = "Android123!";
            const androidUserId = await this.cloneUser(id, baseAndroidUser, password);
            const adminUserId = await this.cloneUser(id, baseAdminUser, password);

            await this.cloneProgramMetadata(id, baseProgramMetadata, androidUserId, adminUserId);
        }
    }

    async cloneUser(id, baseUser, password) {
        const user = this.copy(baseUser);
        user.username = `${baseUser.username}${id}`;
        user.name = this.prefix(id, baseUser.name);
        user.firstName = this.prefix(id, baseUser.firstName);
        user.id = (await this.getIds())[0];
        user.password = password;

        const response = await this.post("users", user).then(r => r.json());

        if (response.status === "OK") {
            console.log(`User ${user.username} created successfully`);
            fs.appendFileSync(usersFilePath, `${this.url},${user.username},${password}\n`)
            return user.id;
        } else {
            throw (`There is a problem creating user ${user.username}`);
        }
    }

    async cloneProgramMetadata(id, baseProgramMetadata, androidUserId, adminUserId) {
        const programMetadata = this.copy(baseProgramMetadata);

        const optionIdMapping = await this.cloneOptions(id, programMetadata);
        const optionSetIdMapping = await this.cloneOptionSets(id, programMetadata, optionIdMapping);

        const dataElementIdMapping = await this.cloneDataElements(id, programMetadata, optionSetIdMapping);

        const programStageSectionIdMapping = await this.cloneProgramStageSections(id, programMetadata, dataElementIdMapping);
        const programStageIdMapping = await this.cloneProgramStages(id, programMetadata, dataElementIdMapping, programStageSectionIdMapping);
        const programIdMapping = await this.cloneProgram(id, programMetadata, programStageIdMapping);

        const programIndicatorIdMapping = await this.cloneProgramIndicators(id, programMetadata, programIdMapping, dataElementIdMapping, programStageIdMapping);

        const programRuleVariableIdMapping = await this.cloneProgramRuleVariables(id, programMetadata, programIdMapping, dataElementIdMapping, programStageIdMapping);
        const programRuleIdMapping = await this.cloneProgramRules(id, programMetadata, programIdMapping);
        const programRuleActionIdMapping = await this.cloneProgramRuleActions(id, programMetadata, dataElementIdMapping, programStageIdMapping, programStageSectionIdMapping, optionIdMapping, programIndicatorIdMapping, programRuleIdMapping);
        this.reAssignProgramRuleActions(id, programMetadata, programRuleActionIdMapping);

        // TO DELETE
        delete programMetadata.system;
        delete programMetadata.trackedEntityTypes;              // Unmodified
        delete programMetadata.trackedEntityAttributes;         // Unmodified
        delete programMetadata.programTrackedEntityAttributes;  // As part of program
        delete programMetadata.programStageDataElements;        // As part of programStage
        delete programMetadata.programNotificationTemplates;    // Not needed
        delete programMetadata.categoryOptions;                 // Unmodified
        delete programMetadata.categories;                      // Unmodified
        delete programMetadata.categoryCombos;                  // Unmodified
        delete programMetadata.categoryOptionCombos;            // Unmodified

        // Sharing
        this.assignProgramMetadataSharing(programMetadata, androidUserId, adminUserId);

        // Changes for exercises
        this.removeProgramStyle(programMetadata);
        this.removeOptionStyle(programMetadata);
        this.setProgramAttributesRenderingToDefault(programMetadata);
        this.setProgramStageSectionRenderingToListing(programMetadata);
        this.removeProgramRules(programMetadata, programRuleIdMapping);

        // Save mapping
        this.saveMappings(id, optionIdMapping, optionIdMapping, dataElementIdMapping, programStageSectionIdMapping,
            programStageIdMapping, programIdMapping, programIndicatorIdMapping,
            programRuleVariableIdMapping, programRuleIdMapping, programRuleActionIdMapping);

        // Post metadata
        const response = await this.post("metadata", programMetadata).then(r => r.json());

        console.log("Import metadata: " + response.response.status);
        console.log(response.response.stats);
        console.log("\n");
        //console.log(JSON.stringify(response, null, 2));
    }

    async cloneOptions(id, program) {
        const optionsSize = program.options.length;
        const newOptionIds = await this.getIds(optionsSize);
        const optionIdMapping = {};

        program.options.forEach((option, idx) => {
            const newOptionId = newOptionIds[idx];
            optionIdMapping[option.id] = newOptionId;
            option.id = newOptionId;
            delete option.optionSet;
        });

        return optionIdMapping;

    }

    async cloneOptionSets(id, program, optionIdMapping) {
        const optionSetsSize = program.optionSets.length;
        const newOptionSetIds = await this.getIds(optionSetsSize);
        const optionSetIdMapping = {};

        program.optionSets.forEach((optionSet, idx) => {
            const newOptionSetId = newOptionSetIds[idx];
            optionSetIdMapping[optionSet.id] = newOptionSetId;
            optionSet.id = newOptionSetId;
            optionSet.name = this.prefix(id, optionSet.name);
            optionSet.code = optionSet.code ? this.prefix(id, optionSet.code) : null;
            optionSet.options.forEach(option => option.id = optionIdMapping[option.id]);
        });

        return optionSetIdMapping;
    }

    async cloneDataElements(id, program, optionSetIdMapping) {
        const dataElementSize = program.dataElements.length;
        const newDataElementIds = await this.getIds(dataElementSize);
        const dataElementIdMapping = {};

        program.dataElements.forEach((dataElement, idx) => {
            const newDataElementId = newDataElementIds[idx];
            dataElementIdMapping[dataElement.id] = newDataElementId;
            dataElement.id = newDataElementId;
            dataElement.formName = dataElement.formName || dataElement.name;
            dataElement.name = this.prefix(id, dataElement.name);
            dataElement.shortName = this.prefix(id, dataElement.shortName);
            dataElement.optionSet = dataElement.optionSet ? {"id": optionSetIdMapping[dataElement.optionSet.id]} : null;
        });

        return dataElementIdMapping;
    }

    async cloneProgramStageSections(id, program, dataElementIdMapping) {
        const programStageSectionSize = program.programStageSections.length;
        const newIds = await this.getIds(programStageSectionSize);
        const programStageSectionIdMapping = {};

        program.programStageSections.forEach((section, idx) => {
            const newSectionId = newIds[idx];
            programStageSectionIdMapping[section.id] = newSectionId;
            section.id = newSectionId;
            section.dataElements.forEach(dataElement => dataElement.id = dataElementIdMapping[dataElement.id]);
            delete section.programStage;
        });

        return programStageSectionIdMapping;
    }

    async cloneProgramStages(id, program, dataElementIdMapping, stageSectionIdMapping) {
        const stagesSize = program.programStages.length;
        const newStageIds = await this.getIds(stagesSize);
        const programStageIdMapping = {};

        program.programStages.forEach((stage, idx) => {
            const newStageId = newStageIds[idx];
            programStageIdMapping[stage.id] = newStageId;
            stage.id = newStageId;
            stage.programStageDataElements.forEach((stageDataElement, idx) => {
                delete stageDataElement.id;
                delete stageDataElement.programStage;
                stageDataElement.dataElement.id = dataElementIdMapping[stageDataElement.dataElement.id];
            });
            stage.programStageSections.forEach(stageSection => {
                stageSection.id = stageSectionIdMapping[stageSection.id]
            });
            delete stage.program;
        });

        return programStageIdMapping;
    }

    async cloneProgram(id, program, stagesIdMapping) {
        const newIds = await this.getIds(program.programs.length);
        const programIdMapping = {};

        program.programs.forEach((program, idx) => {
            const newProgramId = newIds[idx];
            programIdMapping[program.id] = newProgramId;
            program.id = newProgramId;
            program.name = this.prefix(id, program.name);
            program.shortName = this.prefix(id, program.shortName);

            program.programStages.forEach(stage => stage.id = stagesIdMapping[stage.id]);
            program.programTrackedEntityAttributes.forEach(programAttribute => {
                delete programAttribute.id;
                delete programAttribute.program;
            });

            delete program.programSections;
            delete program.notificationTemplates;
        })

        return programIdMapping;
    }

    async cloneProgramIndicators(id, program, programIdMapping, dataElementIdMapping, stageIdMapping) {
        const programIndicatorsSize = program.programIndicators.length;
        const newProgramIndicatorIds = await this.getIds(programIndicatorsSize);
        const programIndicatorIdMapping = {};

        const boundariesIds = await this.getIds(programIndicatorsSize * 4); // Just to be sure we have enough ids in case an indicator has more than 2 boundaries
        let boundaryIdx = 0;

        program.programIndicators.forEach((programIndictor, idx) => {
            const newProgramIndicatorId = newProgramIndicatorIds[idx];
            programIndicatorIdMapping[programIndictor.id] = newProgramIndicatorId;
            programIndictor.id = newProgramIndicatorId;
            programIndictor.program.id = programIdMapping[programIndictor.program.id];
            programIndictor.name = this.prefix(id, programIndictor.name);
            programIndictor.shortName = this.prefix(id, programIndictor.shortName);
            delete programIndictor.code;

            programIndictor.analyticsPeriodBoundaries.forEach(boundary => {
                boundary.id = boundariesIds[boundaryIdx++];
            })

            for (let oldId in dataElementIdMapping) {
                programIndictor.expression = this.replaceExpressionMapping(programIndictor.expression, dataElementIdMapping, stageIdMapping);
                programIndictor.filter = this.replaceExpressionMapping(programIndictor.filter, dataElementIdMapping, stageIdMapping);
            }
        });

        return programIndicatorIdMapping;
    }

    async cloneProgramRuleVariables(id, program, programIdMapping, dataElementIdMapping, stageIdMapping) {
        const variableSize = program.programRuleVariables.length;
        const newIds = await this.getIds(variableSize);
        const variableIdMapping = {};

        program.programRuleVariables.forEach((variable, idx) => {
            const newVariableId = newIds[idx];
            variableIdMapping[variable.id] = newVariableId;
            variable.id = newVariableId;
            if (variable.program != null) {
                variable.program = {"id": programIdMapping[variable.program.id]};
            }
            if (variable.programStage != null) {
                variable.programStage = {"id": stageIdMapping[variable.programStage.id]};
            }
            if (variable.dataElement != null) {
                variable.dataElement = {"id": dataElementIdMapping[variable.dataElement.id]};
            }
        });

        return variableIdMapping;
    }

    async cloneProgramRuleActions(id, program, dataElementIdMapping, stageIdMapping, stageSectionIdMapping, optionIdMapping, programIndicatorIdMapping, ruleIdMapping) {
        const actionsSize = program.programRuleActions.length;
        const newActionsIds = await this.getIds(actionsSize);
        const actionIdMapping = {};

        program.programRuleActions.forEach((action, idx) => {
            const newActionId = newActionsIds[idx];
            actionIdMapping[action.id] = newActionId;
            action.id = newActionId;
            action.programRule.id = ruleIdMapping[action.programRule.id]

            if (action.dataElement != null) {
                action.dataElement = {"id": dataElementIdMapping[action.dataElement.id]};
            }
            if (action.programStage != null) {
                action.programStage = {"id": stageIdMapping[action.programStage.id]};
            }
            if (action.programStageSection != null) {
                action.programStageSection = {"id": stageSectionIdMapping[action.programStageSection.id]};
            }
            if (action.option != null) {
                action.option = {"id": optionIdMapping[action.option.id]};
            }
            if (action.programIndicator != null) {
                action.programIndicator = {"id": programIndicatorIdMapping[action.programIndicator.id]};
            }
        });

        return actionIdMapping;
    }

    async cloneProgramRules(id, program, programIdMapping) {
        const rulesSize = program.programRules.length;
        const newIds = await this.getIds(rulesSize);
        const programRuleIdMapping = {};

        program.programRules.forEach((rule, idx) => {
            const newProgramRuleId = newIds[idx];
            programRuleIdMapping[rule.id] = newProgramRuleId;
            rule.id = newProgramRuleId;
            rule.program.id = programIdMapping[rule.program.id];
            rule.name = this.prefix(id, rule.name);
        });

        return programRuleIdMapping;
    }

    reAssignProgramRuleActions(id, program, programRuleActionIdMapping) {
        program.programRules.forEach(rule => {
            rule.programRuleActions.forEach(action => {
                action.id = programRuleActionIdMapping[action.id];
            })
        })
    }

    assignProgramMetadataSharing(programMetadata, androidUserId, adminUserId) {
        const usersSharing = {};
        usersSharing[androidUserId] = {"access": "r-rw----", "id": androidUserId}
        usersSharing[adminUserId] = {"access": "rw------", "id": adminUserId}
        usersSharing[superAdminUserId] = {"access": "rw------", "id": superAdminUserId};

        const userGroupsSharing = {};
        userGroupsSharing[superAdminGroupId] = {"access": "rwrw----", "id": superAdminGroupId};

        const programSharing = {
            "public": "r-------",
            "users": usersSharing,
            "userGroups": userGroupsSharing
        }
        const restrictedSharing = {
            "public": "--------",
            "users": usersSharing,
            "userGroups": userGroupsSharing
        }


        programMetadata.programs.forEach(program => {
            program.sharing = programSharing
        });
        programMetadata.programStages.forEach(stage => {
            stage.sharing = programSharing
        });

        programMetadata.optionSets.forEach(optionSet => {
            optionSet.sharing = restrictedSharing;
        });

        programMetadata.programIndicators.forEach(programIndicator => {
            programIndicator.sharing = restrictedSharing;
        })
    }

    removeProgramStyle(programMetadata) {
        programMetadata.programs.forEach(program => {
            delete program.style;
        });
    }

    removeOptionStyle(programMetadata) {
        programMetadata.options.forEach(option => {
            delete option.style;
        });
    }

    setProgramStageSectionRenderingToListing(programMetadata) {
        programMetadata.programStageSections.forEach(section => {
            if (section.renderType != null) {
                section.renderType.MOBILE.type = "LISTING";
            }
        })
    }

    removeProgramRules(programMetadata, programRuleIdMapping) {
        const mappedRulesToDelete = programRuleToDelete.map(oldRuleId => programRuleIdMapping[oldRuleId]);

        programMetadata.programRules = programMetadata.programRules.filter(rule => {
            return !mappedRulesToDelete.includes(rule.id)
        });
        programMetadata.programRuleActions = programMetadata.programRuleActions.filter(action => {
            return !mappedRulesToDelete.includes(action.programRule.id);
        })
    }

    setProgramAttributesRenderingToDefault(programMetadata) {
        programMetadata.programs.forEach(program => {
            program.programTrackedEntityAttributes.forEach(attribute => {
                delete attribute.renderType;
            });
        });
    }

    saveMappings(id, options, optionSets, dataElements, programStageSections, programStages, programs, programIndicators,
                 programRuleVariables, programRules, programRuleActions) {
        const content = fs.readFileSync(mappingFile, 'utf8').toString();
        const existingMapping = JSON.parse(content);

        const instanceMapping = existingMapping.find(m => m.url === this.url) || {};

        const newInstanceMapping = {
            "options": Object.assign(instanceMapping.options || {}, options),
            "optionSets": Object.assign(instanceMapping.optionSets || {}, optionSets),
            "dataElements": Object.assign(instanceMapping.dataElements || {}, dataElements),
            "programStageSections": Object.assign(instanceMapping.programStageSections || {}, programStageSections),
            "programStages": Object.assign(instanceMapping.programStages || {}, programStages),
            "programs": Object.assign(instanceMapping.programs || {}, programs),
            "programIndicators": Object.assign(instanceMapping.programIndicators || {}, programIndicators),
            "programRuleVariables": Object.assign(instanceMapping.programRuleVariables || {}, programRuleVariables),
            "programRules": Object.assign(instanceMapping.programRules || {}, programRules),
            "programRuleActions": Object.assign(instanceMapping.programRuleActions || {}, programRuleActions)
        };

        const newMapping = existingMapping.concat({
            "url": this.url,
            "userIdx": id,
            "mapping": newInstanceMapping
        });

        fs.writeFileSync(mappingFile, JSON.stringify(newMapping, null, 2));
    }

    replaceExpressionMapping(expression, dataElementIdMapping, stageIdMapping) {
        if (expression != null) {
            let newExpression = expression;

            for (let oldId in dataElementIdMapping) {
                newExpression = newExpression.replaceAll(oldId, dataElementIdMapping[oldId]);
            }

            for (let oldId in stageIdMapping) {
                newExpression = newExpression.replaceAll(oldId, stageIdMapping[oldId]);
            }

            return newExpression
        } else {
            return null;
        }
    }

    prefix(idx, str) {
        return `[User ${idx}] ${str}`
    }

    getIds(number = 1) {
        return this.get(`system/id?limit=${number}`)
            .then(response => response.json())
            .then(json => json.codes);
    }

    // NETWORK

    headers = {
        'Authorization': 'Basic ' + Buffer.from(user.username + ":" + user.password).toString('base64'),
        "Content-Type": "application/json"
    }

    get(apiStr) {
        return fetch(this.url + "/api/" + apiStr, {
            headers: this.headers
        });
    }

    post(apiStr, body) {
        return fetch(this.url + "/api/" + apiStr, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(body)
        })
    }

    copy(object) {
        return JSON.parse(JSON.stringify(object));
    }
}

const start = new Date().getTime();
main().then(() => {
    const end = new Date().getTime();
    console.log("Process completed in " + ((end - start) / 1000) + " seconds.");
});
