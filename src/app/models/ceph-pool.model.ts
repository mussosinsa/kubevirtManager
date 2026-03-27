export class CephPool {
    namespace: string = '';
    name: string = '';
    failureDomain: string = 'host';
    replicas: number = 3;
    /** 'Ready' | 'Progressing' | 'Failure' | '' */
    phase: string = '';
    creationTimestamp: string = '';
}
