export class KubeVirtMigration {
    name: string = "";
    namespace: string = "";
    vmiName: string = "";
    /* phase: Pending | Scheduling | Scheduled | PreparingTarget | TargetReady | Running | Succeeded | Failed | Unknown */
    phase: string = "";
    sourceNode: string = "";
    targetNode: string = "";
    creationTimestamp: Date = new Date();
}
