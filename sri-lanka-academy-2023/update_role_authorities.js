import DHIS2HttpClient from "./dhis_http_client.js";

export default class UpdateRoleJob {
    constructor(
        user,
        instances,
        roleId,
        addAuthoritiesList,
        removeAuthoritiesList
    ) {
        this.user = user;
        this.instances = instances;

        this.roleId = roleId;
        this.addAuthoritiesList = addAuthoritiesList || [];
        this.removeAuthoritiesList = removeAuthoritiesList || [];
    }

    async doWork() {
        for (let instance of this.instances) {
            const httpClient = new DHIS2HttpClient(instance.url, this.user);

            console.log(`Updating role ${this.roleId} (${instance.url})`);

            const role = await httpClient.get(`userRoles/${this.roleId}.json`).then(r => r.json());

            const existingAuthorities = role.authorities;

            role.authorities = existingAuthorities
                .filter(authority => {
                    return !this.addAuthoritiesList.includes(authority) &&
                        !this.removeAuthoritiesList.includes(authority);
                })
                .concat(this.addAuthoritiesList);

            const importMode = "COMMIT";
            await httpClient.postToMetadata({"userRoles" : [role]}, importMode);
        }
    }
}
