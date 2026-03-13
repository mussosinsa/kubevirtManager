export class PaasApp {
    namespace: string = '';
    name: string = '';
    containerName: string = '';
    image: string = '';
    replicas: number = 0;
    readyReplicas: number = 0;
    availableReplicas: number = 0;
    /** 'available' | 'progressing' | 'degraded' */
    status: string = 'progressing';
    port: number = 0;
    creationTimestamp: string = '';
}
