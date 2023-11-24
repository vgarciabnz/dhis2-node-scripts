import fetch from 'node-fetch';

const url = "http://localhost:8080"

const user = {
    username: "admin",
    password: "district"
}

const baseAndroidUserId = "zGnHx4TUCTM";
const baseAdminUserId = "scysIITtJGV";
const userFields = "name,username,surname,firstName,organisationUnits,teiSearchOrganisationUnits,id,userRoles,userGroups";

const baseProgramId = "SSLpOM0r1U7" // Immunization

const programRuleToDelete = [
    "rhispzm1059"
];

async function cloneMetadata(fromIdx, toIdx) {

    // Download base metadata (user, program)
    const baseAndroidUser = await (await get(`users/${baseAndroidUserId}?fields=${userFields}`)).json();

    //TODO
    //const baseAdminUser = await (await get(`users/${baseAdminUserId}?fields=${userFields}`)).json();

    const baseProgramMetadata = await (await get(`programs/${baseProgramId}/metadata`)).json();

    for (let id = fromIdx; id <= toIdx; id++) {
        // Clone the users
        console.log(`Starting cloning process for user ${id}`);

        //TODO
        //const androidUserId = await cloneUser(id, baseAndroidUser);
        //const adminUserId = await cloneUser(id, baseAdminUser);

        await cloneProgramMetadata(id, baseProgramMetadata);
    }
}

async function cloneUser(id, baseUser) {
    const user = copy(baseUser);
    user.username = `${baseUser.username}_user${id}`;
    user.name = prefix(id, baseUser.name);
    user.firstName = prefix(id, baseUser.firstName);
    user.id = (await getIds())[0];

    const response = await post("users", user).then(r => r.json());

    if (response.status === "OK") {
        console.log(`User ${user.username} created successfully`);
        return user.id;
    } else {
        throw(`There is a problem creating user ${user.username}`);
    }
}

async function cloneProgramMetadata(id, baseProgramMetadata) {
    const programMetadata = copy(baseProgramMetadata);

    const optionIdMapping = await cloneOptions(id, programMetadata);
    const optionSetIdMapping = await cloneOptionSets(id, programMetadata, optionIdMapping);

    const dataElementIdMapping = await cloneDataElements(id, programMetadata, optionSetIdMapping);

    const programStageSectionIdMapping = await cloneProgramStageSections(id, programMetadata, dataElementIdMapping);
    const programStageIdMapping = await cloneProgramStages(id, programMetadata, dataElementIdMapping, programStageSectionIdMapping);
    const programIdMapping = await cloneProgram(id, programMetadata, programStageIdMapping);

    const programIndicatorIdMapping = await cloneProgramIndicators(id, programMetadata, programIdMapping, dataElementIdMapping, programStageIdMapping);

    const programRuleVariableIdMapping = await cloneProgramRuleVariables(id, programMetadata, programIdMapping, dataElementIdMapping, programStageIdMapping);
    const programRuleIdMapping = await cloneProgramRules(id, programMetadata, programIdMapping);
    const programRuleActionIdMapping = await cloneProgramRuleActions(id, programMetadata, dataElementIdMapping, programStageIdMapping, programStageSectionIdMapping, optionIdMapping, programIndicatorIdMapping, programRuleIdMapping);

    // TODO CHECK IF WE NEED THEM
    delete programMetadata.programNotificationTemplates;    // TODO

    // TO DELETE
    delete programMetadata.system;
    delete programMetadata.trackedEntityTypes;              // Unmodified
    delete programMetadata.trackedEntityAttributes;         // Unmodified
    delete programMetadata.programTrackedEntityAttributes;  // As part of program
    delete programMetadata.programStageDataElements;        // As part of programStage
    delete programMetadata.categoryOptions;                 // Unmodified
    delete programMetadata.categories;                      // Unmodified
    delete programMetadata.categoryCombos;                  // Unmodified
    delete programMetadata.categoryOptionCombos;            // Unmodified


    const response = await post("metadata", programMetadata).then(r => r.json());
    console.log("Import metadata: " + response.response.status);
    console.log(response.response.stats);
}

async function cloneOptions(id, program) {
    const optionsSize = program.options.length;
    const newOptionIds = await getIds(optionsSize);
    const optionIdMapping = {};

    program.options.forEach((option, idx) => {
        const newOptionId = newOptionIds[idx];
        optionIdMapping[option.id] = newOptionId;
        option.id = newOptionId;
        delete option.optionSet;
    });

    return optionIdMapping;

}

async function cloneOptionSets(id, program, optionIdMapping) {
    const optionSetsSize = program.optionSets.length;
    const newOptionSetIds = await getIds(optionSetsSize);
    const optionSetIdMapping = {};

    program.optionSets.forEach((optionSet, idx) => {
        const newOptionSetId = newOptionSetIds[idx];
        optionSetIdMapping[optionSet.id] = newOptionSetId;
        optionSet.id = newOptionSetId;
        optionSet.name = prefix(id, optionSet.name);
        optionSet.code = optionSet.code ? prefix(id, optionSet.code) : null;
        optionSet.options.forEach(option => option.id = optionIdMapping[option.id]);
    });

    return optionSetIdMapping;
}

async function cloneDataElements(id, program, optionSetIdMapping) {
    const dataElementSize = program.dataElements.length;
    const newDataElementIds = await getIds(dataElementSize);
    const dataElementIdMapping = {};

    program.dataElements.forEach((dataElement, idx) => {
        const newDataElementId = newDataElementIds[idx];
        dataElementIdMapping[dataElement.id] = newDataElementId;
        dataElement.id = newDataElementId;
        dataElement.formName = dataElement.formName || dataElement.name;
        dataElement.name = prefix(id, dataElement.name);
        dataElement.shortName = prefix(id, dataElement.shortName);
        dataElement.optionSet = dataElement.optionSet ? { "id": optionSetIdMapping[dataElement.optionSet.id] } : null;
    });

    return dataElementIdMapping;
}

async function cloneProgramStageSections(id, program, dataElementIdMapping) {
    const programStageSectionSize = program.programStageSections.length;
    const newIds = await getIds(programStageSectionSize);
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

async function cloneProgramStages(id, program, dataElementIdMapping, stageSectionIdMapping) {
    const stagesSize = program.programStages.length;
    const newStageIds = await getIds(stagesSize);
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

async function cloneProgram(id, program, stagesIdMapping) {
    const newIds = await getIds(program.programs.length);
    const programIdMapping = {};

    program.programs.forEach((program, idx) => {
        const newProgramId = newIds[idx];
        programIdMapping[program.id] = newProgramId;
        program.id = newProgramId;
        program.name = prefix(id, program.name);
        program.shortName = prefix(id, program.shortName);

        program.programStages.forEach(stage => stage.id = stagesIdMapping[stage.id]);
        program.programTrackedEntityAttributes.forEach(programAttribute => {
            delete programAttribute.id;
            delete programAttribute.program;
        });

        //TODO
        delete program.programSections;

        //TODO
        delete program.notificationTemplates;

    })

    return programIdMapping;
}

async function cloneProgramIndicators(id, program, programIdMapping, dataElementIdMapping, stageIdMapping) {
    const programIndicatorsSize = program.programIndicators.length;
    const newProgramIndicatorIds = await getIds(programIndicatorsSize);
    const programIndicatorIdMapping = {};

    const boundariesIds = await getIds(programIndicatorsSize * 4); // Just to be sure we have enough ids in case an indicator has more than 2 boundaries
    let boundaryIdx = 0;

    program.programIndicators.forEach((programIndictor, idx) => {
        const newProgramIndicatorId = newProgramIndicatorIds[idx];
        programIndicatorIdMapping[programIndictor.id] = newProgramIndicatorId;
        programIndictor.id = newProgramIndicatorId;
        programIndictor.program.id = programIdMapping[programIndictor.program.id];
        programIndictor.name = prefix(id, programIndictor.name);
        programIndictor.shortName = prefix(id, programIndictor.shortName);
        delete programIndictor.code;

        programIndictor.analyticsPeriodBoundaries.forEach(boundary => {
            boundary.id = boundariesIds[boundaryIdx++];
        })

        for (let oldId in dataElementIdMapping) {
            programIndictor.expression = replaceExpressionMapping(programIndictor.expression, dataElementIdMapping, stageIdMapping);
            programIndictor.filter = replaceExpressionMapping(programIndictor.filter, dataElementIdMapping, stageIdMapping);
        }
    });

    return programIndicatorIdMapping;
}

async function cloneProgramRuleVariables(id, program, programIdMapping, dataElementIdMapping, stageIdMapping) {
    const variableSize = program.programRuleVariables.length;
    const newIds = await getIds(variableSize);
    const variableIdMapping = {};

    program.programRuleVariables.forEach((variable, idx) => {
        const newVariableId = newIds[idx];
        variableIdMapping[variable.id] = newVariableId;
        variable.id = newVariableId;
        if (variable.program != null) {
            variable.program = { "id" : programIdMapping[variable.program.id] };
        }
        if (variable.programStage != null) {
            variable.programStage = { "id" : stageIdMapping[variable.programStage.id] };
        }
        if (variable.dataElement != null) {
            variable.dataElement = { "id" : dataElementIdMapping[variable.dataElement.id] };
        }
    });

    return variableIdMapping;
}

async function cloneProgramRuleActions(id, program, dataElementIdMapping, stageIdMapping, stageSectionIdMapping, optionIdMapping, programIndicatorIdMapping, ruleIdMapping) {
    const actionsSize = program.programRuleActions.length;
    const newActionsIds = await getIds(actionsSize);
    const actionIdMapping = {};

    program.programRuleActions = program.programRuleActions.filter(action => !programRuleToDelete.includes(action.programRule.id));

    program.programRuleActions.forEach((action, idx) => {
        const newActionId = newActionsIds[idx];
        actionIdMapping[action.id] = newActionId;
        action.id = newActionId;
        action.programRule.id = ruleIdMapping[action.programRule.id]

        if (action.dataElement != null) {
            action.dataElement = { "id": dataElementIdMapping[action.dataElement.id] };
        }
        if (action.programStage != null) {
            action.programStage = { "id": stageIdMapping[action.programStage.id] };
        }
        if (action.programStageSection != null) {
            action.programStageSection = { "id": stageSectionIdMapping[action.programStageSection.id] };
        }
        if (action.option != null) {
            action.option = { "id": optionIdMapping[action.option.id] };
        }
        if (action.programIndicator != null) {
            action.programIndicator = { "id": programIndicatorIdMapping[action.programIndicator.id] };
        }
    });

    return actionIdMapping;
}

async function cloneProgramRules(id, program, programIdMapping) {
    const rulesSize = program.programRules.length;
    const newIds = await getIds(rulesSize);
    const programRuleIdMapping = {};

    program.programRules = program.programRules.filter(r => !programRuleToDelete.includes(r.id));

    program.programRules.forEach((rule, idx) => {
        const newProgramRuleId = newIds[idx];
        programRuleIdMapping[rule.id] = newProgramRuleId;
        rule.id = newProgramRuleId;
        rule.program.id = programIdMapping[rule.program.id];
        rule.name = prefix(id, rule.name);
        delete rule.programRuleActions;
    });

    return programRuleIdMapping;
}

function replaceExpressionMapping(expression, dataElementIdMapping, stageIdMapping) {
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

function prefix(idx, str) {
    return `[User ${idx}] ${str}`
}

function getIds(number = 1) {
    return get(`system/id?limit=${number}`)
        .then(response => response.json())
        .then(json => json.codes);
}

// NETWORK

const headers = {
    'Authorization': 'Basic ' + Buffer.from(user.username + ":" + user.password).toString('base64'),
    "Content-Type": "application/json"
}

function get(apiStr) {
    return fetch(url + "/api/" + apiStr, {
        headers: headers
    });
}

function post(apiStr, body) {
    return fetch(url + "/api/" + apiStr, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
    })
}

function copy(object) {
    return JSON.parse(JSON.stringify(object));
}

cloneMetadata(1, 5);
