export class CephObjectStore {
    namespace: string = '';
    name: string = '';
    replicas: number = 3;
    port: number = 80;
    /** 'Ready' | 'Progressing' | 'Failure' | '' */
    phase: string = '';
    endpoint: string = '';
    creationTimestamp: string = '';
}
