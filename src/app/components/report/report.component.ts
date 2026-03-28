import { ChangeDetectorRef, Component } from '@angular/core';

import { ReportService } from 'src/app/services/report.service';
import {
    REPORT_FORMATS,
    REPORT_TEMPLATES,
    ReportData,
    ReportFormat,
    ReportFormatId,
    ReportTemplate,
    ReportTemplateId,
} from 'src/app/models/report.model';

@Component({
    selector: 'app-report',
    templateUrl: './report.component.html',
    styleUrls: ['./report.component.css'],
})
export class ReportComponent {

    pageName = '운영 보고서';

    /* ── 위저드 단계 (1~3) ─────────────────────── */
    step = 1;

    /* ── 선택값 ────────────────────────────────── */
    selectedTemplate: ReportTemplateId | null = null;
    selectedFormat:   ReportFormatId   | null = null;

    /* ── 정적 목록 ─────────────────────────────── */
    templates: ReportTemplate[] = REPORT_TEMPLATES;
    formats:   ReportFormat[]   = REPORT_FORMATS;

    /* ── 보고서 상태 ────────────────────────────── */
    loading  = false;
    error    = '';
    data: ReportData | null = null;

    constructor(
        private reportService: ReportService,
        private cdRef: ChangeDetectorRef,
    ) {}

    ngOnInit() {
        const navTitle = document.getElementById('nav-title');
        if (navTitle) navTitle.replaceChildren(this.pageName);
    }

    /* ── 위저드 네비게이션 ─────────────────────── */

    selectTemplate(id: ReportTemplateId) { this.selectedTemplate = id; }
    selectFormat(id: ReportFormatId)     { this.selectedFormat   = id; }

    nextStep() {
        if (this.step === 1 && this.selectedTemplate) this.step = 2;
        else if (this.step === 2 && this.selectedFormat) this.step = 3;
    }

    prevStep() {
        if (this.step > 1) { this.step--; this.data = null; this.error = ''; }
    }

    /* ── 보고서 생성 ────────────────────────────── */

    async generate() {
        if (!this.selectedTemplate || !this.selectedFormat) return;
        this.loading = true;
        this.error   = '';
        this.data    = null;
        try {
            this.data = await this.reportService.gather(this.selectedTemplate);
        } catch (e: any) {
            this.error = `데이터 수집 중 오류가 발생했습니다: ${e?.message ?? e}`;
        } finally {
            this.loading = false;
            this.cdRef.detectChanges();
        }
    }

    /* ── 내보내기 ───────────────────────────────── */

    exportPdf() {
        window.print();
    }

    exportCsv() {
        if (!this.data) return;
        const csv  = this.reportService.buildCsv(this.data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        this.downloadBlob(blob, `report_${this.dateStamp()}.csv`);
    }

    exportJson() {
        if (!this.data) return;
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        this.downloadBlob(blob, `report_${this.dateStamp()}.json`);
    }

    private downloadBlob(blob: Blob, filename: string) {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    private dateStamp(): string {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    /* ── 헬퍼 ──────────────────────────────────── */

    get templateLabel(): string {
        return this.templates.find(t => t.id === this.selectedTemplate)?.label ?? '';
    }

    get formatLabel(): string {
        return this.formats.find(f => f.id === this.selectedFormat)?.label ?? '';
    }

    /** 현재 템플릿에서 특정 섹션을 표시할지 여부 */
    showSection(section: 'nodes' | 'vms' | 'cicd' | 'hci'): boolean {
        if (!this.selectedTemplate) return false;
        if (this.selectedTemplate === 'comprehensive') return true;
        const map: Record<string, string[]> = {
            cluster_summary: ['nodes', 'vms'],
            vm_ops:          ['vms'],
            node_resources:  ['nodes'],
            cicd_deploy:     ['cicd'],
            hci_storage:     ['hci'],
        };
        return (map[this.selectedTemplate] ?? []).includes(section);
    }

    /** VM 상태 배지 클래스 */
    vmBadge(status: string): string {
        if (status === 'Running')  return 'badge badge-success';
        if (status === 'Stopped')  return 'badge badge-secondary';
        if (status === 'Starting') return 'badge badge-warning';
        return 'badge badge-danger';
    }

    /** Deployment 준비율에 따른 배지 */
    deployBadge(ready: string, desired: number): string {
        const parts = ready.split('/');
        const r = parseInt(parts[0], 10);
        if (r === desired) return 'badge badge-success';
        if (r > 0)         return 'badge badge-warning';
        return 'badge badge-danger';
    }

    /** Ceph 헬스 배지 */
    cephBadge(health: string): string {
        if (health === 'HEALTH_OK')   return 'badge badge-success';
        if (health === 'HEALTH_WARN') return 'badge badge-warning';
        return 'badge badge-danger';
    }
}
