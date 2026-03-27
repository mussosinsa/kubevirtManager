export class CephFilesystem {
    namespace: string = '';
    name: string = '';
    dataPoolReplicas: number = 3;
    metaReplicas: number = 3;
    activeCount: number = 1;
    /** 'Ready' | 'Progressing' | 'Failure' | '' */
    phase: string = '';
    creationTimestamp: string = '';
}
