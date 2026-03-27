export class CephCluster {
    namespace: string = '';
    name: string = '';
    cephVersion: string = '';
    monCount: number = 3;
    /** 'Ready' | 'Progressing' | 'Error' | 'Unknown' */
    phase: string = 'Unknown';
    /** 'HEALTH_OK' | 'HEALTH_WARN' | 'HEALTH_ERR' | '' */
    health: string = '';
    message: string = '';
    capacity: string = '';
    osdCount: number = 0;
    creationTimestamp: string = '';
}
