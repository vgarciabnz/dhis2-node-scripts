import fetch from "node-fetch";

export default class DHIS2HttpClient {
    constructor(
        url,
        user
    ) {
        this.url = url;
        this.user = user;
        this.headers = this.getHeaders();
    }

    getHeaders() {
        return {
            'Authorization': 'Basic ' + Buffer.from(this.user.username + ":" + this.user.password).toString('base64'),
            "Content-Type": "application/json"
        }
    };

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

    getIds(number = 1) {
        return this.get(`system/id?limit=${number}`)
            .then(response => response.json())
            .then(json => json.codes);
    }

    async postToMetadata(body, importMode) {
        const response = await this.post(`metadata?importMode=${importMode}`, body).then(r => r.json());
        console.log("Import metadata: " + response.response.status);
        console.log(response.response.stats);
    }
}
