/** 노드별 AI 스케줄링 점수 결과 */
export class NodeScore {
    name:             string = '';
    ready:            boolean = true;

    /* ── 리소스 ───────────────────── */
    cpuAllocatable:   number = 0;   // 코어
    cpuRequested:     number = 0;   // 코어
    memAllocatable:   number = 0;   // MiB
    memRequested:     number = 0;   // MiB

    /* ── 서브 점수 (0-100) ─────────── */
    cpuScore:         number = 0;   // LeastRequested (CPU)
    memScore:         number = 0;   // LeastRequested (Memory)
    balanceScore:     number = 0;   // BalancedResourceAllocation
    affinityScore:    number = 0;   // NodeAffinity Preferred
    topologyScore:    number = 0;   // TopologySpread
    podAffinityScore: number = 0;   // PodAffinity / AntiAffinity

    /** 가중 합산 종합 점수 (0-100) */
    totalScore:       number = 0;

    /** 필터 통과 여부 (false면 배치 불가) */
    filtered:         boolean = true;
    filterReason:     string = '';

    /** 'best' | 'good' | 'fair' | 'poor' */
    recommendation:   string = 'fair';

    /** 노드 레이블 (원본) */
    labels:           Record<string, string> = {};

    /** 노드 테인트 (원본) */
    taints:           { key: string; value?: string; effect: string }[] = [];

    /** 현재 실행 파드 수 */
    podCount:         number = 0;

    /** 존/랙 구분 (topology key 값) */
    topologyZone:     string = '';
}
