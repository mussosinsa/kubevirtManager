export class GlusterStorage {
    namespace: string = '';
    name: string = '';
    /** 'Replica1' | 'Replica2' | 'Replica3' | 'Disperse' */
    type: string = 'Replica3';
    volumeCount: number = 0;
    /** 'Ready' | 'Progressing' | 'Failure' | '' */
    phase: string = '';
    creationTimestamp: string = '';
    storageNodes: { node: string; path: string }[] = [];
}
