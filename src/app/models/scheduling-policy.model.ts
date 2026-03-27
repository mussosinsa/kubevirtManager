/** nodeSelector 엔트리 */
export interface LabelEntry {
    key: string;
    value: string;
}

/** Node Affinity 표현식 */
export interface AffinityExpr {
    key: string;
    /** 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt' */
    operator: string;
    values: string;   // 쉼표 구분 문자열
}

/** 선호 NodeAffinity 항목 */
export interface PreferredAffinity {
    weight: number;
    expressions: AffinityExpr[];
}

/** Toleration 엔트리 */
export interface Toleration {
    key: string;
    operator: string;   // 'Equal' | 'Exists'
    value: string;
    effect: string;     // 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute' | ''
}

/** Pod Affinity/AntiAffinity 항목 */
export interface PodAffinityRule {
    topologyKey: string;
    labelKey: string;
    labelValue: string;
    /** 'required' | 'preferred' */
    scheduling: string;
}

/** Topology Spread Constraint */
export interface TopologyConstraint {
    topologyKey: string;
    maxSkew: number;
    /** 'DoNotSchedule' | 'ScheduleAnyway' */
    whenUnsatisfiable: string;
    labelKey: string;
    labelValue: string;
}

/** AI 스케줄링 전체 정책 */
export class SchedulingPolicy {
    /* ─ 리소스 요구사항 ─ */
    cpuRequest:  number = 0;   // 코어
    memRequest:  number = 0;   // MiB

    /* ─ 알고리즘 가중치 (합계 = 100) ─ */
    weightLeastRequested:     number = 30;
    weightBalancedAllocation: number = 25;
    weightNodeAffinity:       number = 20;
    weightTopologySpread:     number = 15;
    weightPodAffinity:        number = 10;

    /* ─ 노드 선택 ─ */
    nodeSelector: LabelEntry[] = [];

    /* ─ Node Affinity ─ */
    requiredAffinity: AffinityExpr[] = [];
    preferredAffinity: PreferredAffinity[] = [
        { weight: 100, expressions: [] }
    ];

    /* ─ Taints / Tolerations ─ */
    tolerations: Toleration[] = [];

    /* ─ Pod Affinity ─ */
    podAffinityRules: PodAffinityRule[] = [];

    /* ─ Pod Anti-Affinity ─ */
    podAntiAffinityRules: PodAffinityRule[] = [];

    /* ─ Topology Spread ─ */
    topologyConstraints: TopologyConstraint[] = [];

    /* ─ Topology 키 (존 레이블) ─ */
    topologyKey: string = 'topology.kubernetes.io/zone';
}
