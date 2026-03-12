export interface AppEnvironment {
    production: boolean;
    keycloak: {
        url: string;
        realm: string;
        clientId: string;
    };
}
