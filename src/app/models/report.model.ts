export type ReportTemplateId =
    | 'cluster_summary'
    | 'vm_ops'
    | 'node_resources'
    | 'cicd_deploy'
    | 'hci_storage'
    | 'comprehensive';

export type ReportFormatId = 'preview' | 'pdf' | 'csv' | 'json';

export interface ReportTemplate {
    id: ReportTemplateId;
    label: string;
    description: string;
    icon: string;
}

export interface ReportFormat {
    id: ReportFormatId;
    label: string;
    description: string;
    icon: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
    { id: 'cluster_summary',  label: '클러스터 전체 요약',    icon: 'fas fa-layer-group',  description: '노드·VM·풀 현황과 클러스터 자원 사용률을 요약합니다.' },
    { id: 'vm_ops',           label: 'VM 운영 현황',          icon: 'fas fa-desktop',      description: '가상 머신 목록, 상태, CPU/메모리 할당 정보를 포함합니다.' },
    { id: 'node_resources',   label: '노드 리소스 현황',      icon: 'fas fa-hdd',          description: '각 노드의 CPU·메모리 용량, 할당량, 역할을 표시합니다.' },
    { id: 'cicd_deploy',      label: 'CI/CD 배포 현황',       icon: 'fas fa-rocket',       description: 'PaaS 앱 Deployment 상태와 레플리카 현황을 보고합니다.' },
    { id: 'hci_storage',      label: 'HCI 스토리지 현황',     icon: 'fas fa-database',     description: 'Ceph 클러스터·풀·GlusterFS 볼륨 상태를 보고합니다.' },
    { id: 'comprehensive',    label: '종합 운영 보고서',       icon: 'fas fa-file-alt',     description: '클러스터·VM·노드·CI/CD·스토리지를 하나의 보고서로 통합합니다.' },
];

export const REPORT_FORMATS: ReportFormat[] = [
    { id: 'preview', label: '화면 미리보기', icon: 'fas fa-eye',        description: '브라우저에서 바로 확인합니다.' },
    { id: 'pdf',     label: 'PDF 다운로드',  icon: 'fas fa-file-pdf',   description: '인쇄 대화상자를 통해 PDF로 저장합니다.' },
    { id: 'csv',     label: 'CSV 다운로드',  icon: 'fas fa-file-csv',   description: '표 데이터를 CSV 파일로 다운로드합니다.' },
    { id: 'json',    label: 'JSON 다운로드', icon: 'fas fa-file-code',  description: '전체 보고서 데이터를 JSON으로 내보냅니다.' },
];

/* ── 데이터 모델 ─────────────────────────────────── */

export interface NodeRow {
    name: string;
    status: string;
    roles: string;
    cpuAllocatable: string;
    memAllocatable: string;
    k8sVersion: string;
    age: string;
}

export interface VmRow {
    name: string;
    namespace: string;
    status: string;
    cpu: string;
    memory: string;
    node: string;
}

export interface DeploymentRow {
    name: string;
    namespace: string;
    ready: string;
    desired: number;
    available: number;
    image: string;
    age: string;
}

export interface HciCephInfo {
    name: string;
    namespace: string;
    phase: string;
    health: string;
    monitors: number;
}

export interface HciGlusterInfo {
    name: string;
    namespace: string;
    phase: string;
    volumes: number;
}

export interface ReportData {
    generatedAt: string;
    templateId: ReportTemplateId;
    cluster: {
        totalNodes: number;
        readyNodes: number;
        totalVMs: number;
        runningVMs: number;
        totalPools: number;
        totalDeployments: number;
    };
    nodes: NodeRow[];
    vms: VmRow[];
    deployments: DeploymentRow[];
    cephClusters: HciCephInfo[];
    glusterVolumes: HciGlusterInfo[];
}
