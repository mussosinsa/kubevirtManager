import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { DataVolumesService } from 'src/app/services/data-volumes.service';
import { K8sApisService } from 'src/app/services/k8s-apis.service';
import { K8sService } from 'src/app/services/k8s.service';
import { KubeVirtService } from 'src/app/services/kube-virt.service';
import { PrometheusService } from 'src/app/services/prometheus.service';
import { Chart } from 'chart.js/auto'
import { XK8sService } from 'src/app/services/x-k8s.service';
import { Constants } from 'src/app/classes/constants';
import { Toasts } from 'src/app/classes/toasts';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

    pageName: string = "Dashboard";

    crdList: any;
    cdiCheck: boolean = false;
    myConstants!: Constants;
    myToasts!: Toasts;

    nodeInfo = { 'total': 0, 'running': 0, 'percent': 0 };
    vmInfo   = { 'total': 0, 'running': 0, 'percent': 0 };
    poolInfo = { 'total': 0, 'running': 0, 'percent': 0 };

    /* Dashboard counters */
    discInfo          = 0;
    cpuInfo           = 0;
    memInfo           = 0;
    storageInfo       = 0;
    netInfo           = 0;
    kclusterInfo      = 0;
    autoscaleInfo     = 0;
    instanceTypesInfo = 0;
    loadBalancers     = 0;

    /* Prometheus */
    promStartTime = 0;
    promEndTime   = 0;
    promInterval  = 3600;
    promStep      = 30;
    prometheusAvailable = false;

    /* Chart.js instances */
    cpuChart:        any;
    memChart:        any;
    netChart:        any;
    stgChart:        any;
    vmStatusChart:   any;
    nodeStatusChart: any;
    poolStatusChart: any;

    myInterval = setInterval(() => { this.reloadComponent(); }, 180000);

    constructor(
        private cdRef: ChangeDetectorRef,
        private k8sService: K8sService,
        private k8sApisService: K8sApisService,
        private kubeVirtService: KubeVirtService,
        private dataVolumesService: DataVolumesService,
        private prometheusService: PrometheusService,
        private xK8sService: XK8sService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if (navTitle != null) { navTitle.replaceChildren(this.pageName); }
        this.myConstants = new Constants();
        this.myToasts = new Toasts();
        /* getNodes()와 loadCrds()는 독립적이므로 병렬 실행 */
        await Promise.all([this.getNodes(), this.loadCrds()]);
        await this.checkCDI();
        this.getVMs();
        this.getDisks();
        this.getNetworks();
        this.getPools();
        this.getClusters();
        this.getScalingGroups();
        this.getInstanceTypes();
        this.getLoadBalancers();
        this.loadPrometheus();
    }

    ngOnDestroy() {
        clearInterval(this.myInterval);
    }

    /* ─── 도넛 차트: VM 상태 ─────────────────── */
    buildVmStatusChart(): void {
        const canvas = document.getElementById('VmStatusChart');
        if (!canvas) return;
        if (this.vmStatusChart) { this.vmStatusChart.destroy(); }
        const stopped = Math.max(0, this.vmInfo.total - this.vmInfo.running);
        const data    = this.vmInfo.total === 0 ? [1] : [this.vmInfo.running, stopped];
        const labels  = this.vmInfo.total === 0 ? ['데이터 없음'] : ['실행 중', '중지됨'];
        const colors  = this.vmInfo.total === 0 ? ['#dee2e6'] : ['#28a745', '#dc3545'];
        this.vmStatusChart = new Chart('VmStatusChart', {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2 }] },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } }
                }
            }
        });
    }

    /* ─── 도넛 차트: 노드 상태 ──────────────── */
    buildNodeStatusChart(): void {
        const canvas = document.getElementById('NodeStatusChart');
        if (!canvas) return;
        if (this.nodeStatusChart) { this.nodeStatusChart.destroy(); }
        const notReady = Math.max(0, this.nodeInfo.total - this.nodeInfo.running);
        const data     = this.nodeInfo.total === 0 ? [1] : [this.nodeInfo.running, notReady];
        const labels   = this.nodeInfo.total === 0 ? ['데이터 없음'] : ['Ready', 'NotReady'];
        const colors   = this.nodeInfo.total === 0 ? ['#dee2e6'] : ['#17a2b8', '#ffc107'];
        this.nodeStatusChart = new Chart('NodeStatusChart', {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2 }] },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } }
                }
            }
        });
    }

    /* ─── 도넛 차트: VM 풀 상태 ─────────────── */
    buildPoolStatusChart(): void {
        const canvas = document.getElementById('PoolStatusChart');
        if (!canvas) return;
        if (this.poolStatusChart) { this.poolStatusChart.destroy(); }
        const stopped = Math.max(0, this.poolInfo.total - this.poolInfo.running);
        const data    = this.poolInfo.total === 0 ? [1] : [this.poolInfo.running, stopped];
        const labels  = this.poolInfo.total === 0 ? ['데이터 없음'] : ['실행 중', '중지됨'];
        const colors  = this.poolInfo.total === 0 ? ['#dee2e6'] : ['#007bff', '#6c757d'];
        this.poolStatusChart = new Chart('PoolStatusChart', {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2 }] },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } }
                }
            }
        });
    }

    /* ─── Prometheus ─────────────────────────── */
    async loadPrometheus(): Promise<void> {
        try {
            const data = await lastValueFrom(this.prometheusService.checkPrometheus());
            if (data["status"].toLowerCase() === "success") {
                this.prometheusAvailable = true;
                await this.getTimestamps();
                await this.cdRef.detectChanges();
                this.cpuGraph();
                this.memGraph();
                this.netGraph();
                this.stgGraph();
            }
        } catch (_) { }
    }

    async reloadPrometheus(): Promise<void> {
        try {
            const data = await lastValueFrom(this.prometheusService.checkPrometheus());
            if (data["status"].toLowerCase() === "success") {
                await this.getTimestamps();
                this.cpuGraphReload();
                this.memGraphReload();
                this.netGraphReload();
                this.stgGraphReload();
            }
        } catch (_) { }
    }

    async getTimestamps(): Promise<void> {
        this.promEndTime   = Math.floor(Date.now() / 1000);
        this.promStartTime = this.promEndTime - this.promInterval;
    }

    /* ─── 데이터 로딩 ────────────────────────── */
    async getNodes(): Promise<void> {
        this.memInfo = 0; this.storageInfo = 0; this.cpuInfo = 0; this.nodeInfo.running = 0;
        try {
            const data  = await lastValueFrom(this.k8sService.getNodes());
            const nodes = data.items;
            this.nodeInfo.total = nodes.length;
            for (let i = 0; i < nodes.length; i++) {
                this.memInfo     += this.convertSize(nodes[i].status.capacity["memory"]);
                this.storageInfo += this.convertSize(nodes[i].status.capacity["ephemeral-storage"]);
                this.cpuInfo     += Number.parseInt(nodes[i].status.capacity["cpu"]);
                const conditions  = nodes[i].status.conditions;
                for (let j = 0; j < conditions.length; j++) {
                    if (conditions[j].type === "Ready" && conditions[j].status === "True") {
                        this.nodeInfo.running += 1;
                    }
                }
            }
            this.nodeInfo.percent = this.nodeInfo.total > 0
                ? Math.round((this.nodeInfo.running * 100) / this.nodeInfo.total) : 0;
            this.storageInfo = Math.round(this.storageInfo * 100) / 100;
            this.memInfo     = Math.round(this.memInfo * 100) / 100;
        } catch (_) { }
        this.buildNodeStatusChart();
    }

    async getVMs(): Promise<void> {
        this.vmInfo.percent = 0; this.vmInfo.total = 0; this.vmInfo.running = 0;
        try {
            const data = await lastValueFrom(this.kubeVirtService.getVMs());
            this.vmInfo.total = data.items.length;
            for (const vm of data.items) {
                if (vm.status["printableStatus"] === "Running") { this.vmInfo.running += 1; }
            }
            this.vmInfo.percent = this.vmInfo.total > 0
                ? Math.round((this.vmInfo.running * 100) / this.vmInfo.total) : 0;
        } catch (_) { }
        this.buildVmStatusChart();
    }

    async getDisks(): Promise<void> {
        try {
            const data = await lastValueFrom(this.dataVolumesService.getDataVolumes());
            this.discInfo = data.items.length;
        } catch (_) { }
    }

    async getNetworks(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getNetworkAttachs());
            this.netInfo = data.items.length;
        } catch (_) { }
    }

    async getPools(): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.getVMPools());
            this.poolInfo.total   = data.items.length;
            this.poolInfo.running = 0;
            for (const pool of data.items) {
                if (pool.spec.virtualMachineTemplate.spec["running"]) { this.poolInfo.running += 1; }
            }
            this.poolInfo.percent = this.poolInfo.total > 0
                ? Math.round((this.poolInfo.running * 100) / this.poolInfo.total) : 0;
        } catch (_) { }
        this.buildPoolStatusChart();
    }

    async getClusters(): Promise<void> {
        try {
            const data = await lastValueFrom(this.xK8sService.getClusters());
            this.kclusterInfo = data.items.length;
        } catch (_) { }
    }

    async getScalingGroups(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getHpas());
            this.autoscaleInfo = data.items.length;
        } catch (_) { }
    }

    async getInstanceTypes(): Promise<void> {
        try {
            const data = await lastValueFrom(this.kubeVirtService.getClusterInstanceTypes());
            this.instanceTypesInfo = data.items.length;
        } catch (_) { }
    }

    async getLoadBalancers(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getServices());
            this.loadBalancers = data.items.length;
        } catch (_) { }
    }

    /* ─── Prometheus 그래프 ──────────────────── */
    async cpuGraphReload(): Promise<void> {
        const response = await lastValueFrom(this.prometheusService.getCpuSummary(this.promStartTime, this.promEndTime, this.promStep));
        const cpuData  = response.data.result[0].values.map((v: any[]) => v[1] * 10);
        this.cpuChart.data.labels            = Array(cpuData.length).fill('');
        this.cpuChart.data.datasets[0].data  = cpuData;
        this.cpuChart.update();
    }

    async cpuGraph(): Promise<void> {
        const response = await lastValueFrom(this.prometheusService.getCpuSummary(this.promStartTime, this.promEndTime, this.promStep));
        const cpuData  = response.data.result[0].values.map((v: any[]) => v[1] * 10);
        this.cpuChart  = new Chart("CpuChart", {
            type: 'line',
            data: {
                labels: Array(cpuData.length).fill(''),
                datasets: [{ label: 'CPU 사용량', pointRadius: 1, tension: 0.4, borderWidth: 2,
                    data: cpuData, backgroundColor: 'rgba(0,123,255,0.15)', borderColor: '#007bff', fill: true }]
            },
            options: {
                aspectRatio: 4,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { min: 0, max: this.cpuInfo + (this.cpuInfo / 10), grid: { display: true } }
                }
            }
        });
    }

    async memGraphReload(): Promise<void> {
        const response = await lastValueFrom(this.prometheusService.getMemSummary(this.promStartTime, this.promEndTime, this.promStep));
        const memData  = response.data.result[0].values.map((v: any[]) => v[1]);
        this.memChart.data.labels           = Array(memData.length).fill('');
        this.memChart.data.datasets[0].data = memData;
        this.memChart.update();
    }

    async memGraph(): Promise<void> {
        const response = await lastValueFrom(this.prometheusService.getMemSummary(this.promStartTime, this.promEndTime, this.promStep));
        const memData  = response.data.result[0].values.map((v: any[]) => v[1]);
        this.memChart  = new Chart("MemChart", {
            type: 'line',
            data: {
                labels: Array(memData.length).fill(''),
                datasets: [{ label: '메모리 사용량 (GB)', pointRadius: 1, tension: 0.4, borderWidth: 2,
                    data: memData, backgroundColor: 'rgba(40,167,69,0.15)', borderColor: '#28a745', fill: true }]
            },
            options: {
                aspectRatio: 4,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { min: 0, max: Math.round(this.memInfo * 1024), grid: { display: true } }
                }
            }
        });
    }

    async netGraphReload(): Promise<void> {
        let response = await lastValueFrom(this.prometheusService.getNetSent(this.promStartTime, this.promEndTime, this.promStep));
        const sentData = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        response = await lastValueFrom(this.prometheusService.getNetRecv(this.promStartTime, this.promEndTime, this.promStep));
        const recvData = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        this.netChart.data.labels            = Array(sentData.length).fill('');
        this.netChart.data.datasets[0].data  = sentData;
        this.netChart.data.datasets[1].data  = recvData;
        this.netChart.update();
    }

    async netGraph(): Promise<void> {
        let response = await lastValueFrom(this.prometheusService.getNetSent(this.promStartTime, this.promEndTime, this.promStep));
        const sentData = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        response = await lastValueFrom(this.prometheusService.getNetRecv(this.promStartTime, this.promEndTime, this.promStep));
        const recvData = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        this.netChart = new Chart("NetChart", {
            type: 'line',
            data: {
                labels: Array(sentData.length).fill(''),
                datasets: [
                    { label: '전송 (MB)', data: sentData, pointRadius: 1, tension: 0.4, borderWidth: 2, borderColor: '#28a745', backgroundColor: 'rgba(40,167,69,0.1)' },
                    { label: '수신 (MB)', data: recvData, pointRadius: 1, tension: 0.4, borderWidth: 2, borderColor: '#007bff', backgroundColor: 'rgba(0,123,255,0.1)' }
                ]
            },
            options: {
                aspectRatio: 4,
                plugins: { legend: { position: 'top' } },
                scales: { x: { grid: { display: false } }, y: { min: 0 } }
            }
        });
    }

    async stgGraphReload(): Promise<void> {
        let response = await lastValueFrom(this.prometheusService.getStorageRead(this.promStartTime, this.promEndTime, this.promStep));
        const readData  = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        response = await lastValueFrom(this.prometheusService.getStorageWrite(this.promStartTime, this.promEndTime, this.promStep));
        const writeData = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        this.stgChart.data.labels           = Array(readData.length).fill('');
        this.stgChart.data.datasets[0].data = readData;
        this.stgChart.data.datasets[1].data = writeData;
        this.stgChart.update();
    }

    async stgGraph(): Promise<void> {
        let response = await lastValueFrom(this.prometheusService.getStorageRead(this.promStartTime, this.promEndTime, this.promStep));
        const readData  = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        response = await lastValueFrom(this.prometheusService.getStorageWrite(this.promStartTime, this.promEndTime, this.promStep));
        const writeData = response.data.result[0].values.map((v: any[]) => (v[1] / 1024) / 1024);
        this.stgChart = new Chart("StgChart", {
            type: 'line',
            data: {
                labels: Array(readData.length).fill(''),
                datasets: [
                    { label: '읽기 (MB)', data: readData,  pointRadius: 1, tension: 0.4, borderWidth: 2, borderColor: '#fd7e14', backgroundColor: 'rgba(253,126,20,0.1)' },
                    { label: '쓰기 (MB)', data: writeData, pointRadius: 1, tension: 0.4, borderWidth: 2, borderColor: '#6f42c1', backgroundColor: 'rgba(111,66,193,0.1)' }
                ]
            },
            options: {
                aspectRatio: 4,
                plugins: { legend: { position: 'top' } },
                scales: { x: { grid: { display: false } }, y: { min: 0 } }
            }
        });
    }

    /* ─── 유틸 ──────────────────────────────── */
    convertSize(inputSize: string): number {
        inputSize = inputSize.replace('Ki', '');
        return Math.round((Number.parseFloat(inputSize) / (1024 * 1024)) * 100) / 100;
    }

    async loadCrds(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sApisService.getCrds());
            this.crdList = data.items;
        } catch (_) { this.crdList = []; }
    }

    async checkCDI(): Promise<void> {
        for (let i = 0; i < this.crdList.length; i++) {
            if (this.crdList[i].metadata["name"] === this.myConstants.ContainerizedDataImporter) {
                this.cdiCheck = true;
            }
        }
        if (!this.cdiCheck) {
            this.myToasts.toastError(this.pageName, "", "CDI (Containerized Data Importer) not found! This component is required for disk and volume operations.");
        }
    }

    async reloadComponent(): Promise<void> {
        await this.getNodes();
        this.getVMs();
        this.getDisks();
        this.getNetworks();
        this.getPools();
        this.getClusters();
        this.getScalingGroups();
        this.getInstanceTypes();
        this.getLoadBalancers();
        this.reloadPrometheus();
        await this.cdRef.detectChanges();
    }
}
