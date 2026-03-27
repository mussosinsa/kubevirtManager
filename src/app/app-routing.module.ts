import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';

import { LocalLoginComponent } from './components/local-login/local-login.component';
import { ClusterInstanceTypeListComponent } from './components/cluster-instance-type-list/cluster-instance-type-list.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DiskListComponent } from './components/disk-list/disk-list.component';
import { LoadBalancersComponent } from './components/load-balancers/load-balancers.component';
import { NetworkListComponent } from './components/network-list/network-list.component';
import { NodelistComponent } from './components/nodelist/nodelist.component';
import { RefreshComponent } from './components/refresh/refresh.component';
import { VmlistComponent } from './components/vmlist/vmlist.component';
import { VMPoolsComponent } from './components/vmpools/vmpools.component';
import { AutoscaleComponent } from './components/autoscale/autoscale.component';
import { VmdetailsComponent } from './components/vmdetails/vmdetails.component';
import { VmpooldetailsComponent } from './components/vmpooldetails/vmpooldetails.component';
import { KClusterComponent } from './components/kcluster/kcluster.component';
import { KClusterDetailsComponent } from './components/kcluster-details/kcluster-details.component';
import { KClusterPoolDetailsComponent } from './components/kcluster-pool-details/kcluster-pool-details.component';
import { ImagesComponent } from './components/images/images.component';
import { SSHKeysComponent } from './components/sshkeys/sshkeys.component';
import { FirewallListComponent } from './components/firewall-list/firewall-list.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ProfileComponent } from './components/profile/profile.component';
import { CicdListComponent } from './components/cicd-list/cicd-list.component';
import { HciStorageComponent } from './components/hci-storage/hci-storage.component';
import { SchedulerAiComponent } from './components/scheduler-ai/scheduler-ai.component';

const routes: Routes = [
  { path: 'login',                                    component: LocalLoginComponent },
  { path: '',                                         component: DashboardComponent,          canActivate: [authGuard] },
  { path: 'dashboard',                                component: DashboardComponent,          canActivate: [authGuard] },
  { path: 'vmlist',                                   component: VmlistComponent,             canActivate: [authGuard] },
  { path: 'vmpools',                                  component: VMPoolsComponent,            canActivate: [authGuard] },
  { path: 'vmdetail/:namespace/:name',                component: VmdetailsComponent,          canActivate: [authGuard] },
  { path: 'vmpooldetail/:namespace/:name',            component: VmpooldetailsComponent,      canActivate: [authGuard] },
  { path: 'autoscale',                                component: AutoscaleComponent,          canActivate: [authGuard] },
  { path: 'nodelist',                                 component: NodelistComponent,           canActivate: [authGuard] },
  { path: 'dsklist',                                  component: DiskListComponent,           canActivate: [authGuard] },
  { path: 'netlist',                                  component: NetworkListComponent,        canActivate: [authGuard] },
  { path: 'lblist',                                   component: LoadBalancersComponent,      canActivate: [authGuard] },
  { path: 'citlist',                                  component: ClusterInstanceTypeListComponent, canActivate: [authGuard] },
  { path: 'refresh',                                  component: RefreshComponent,            canActivate: [authGuard] },
  { path: 'kcluster',                                 component: KClusterComponent,           canActivate: [authGuard] },
  { path: 'kclusterdetails/:namespace/:name',         component: KClusterDetailsComponent,    canActivate: [authGuard] },
  { path: 'kclusterpooldetails/:namespace/:name',     component: KClusterPoolDetailsComponent, canActivate: [authGuard] },
  { path: 'imagelist',                                component: ImagesComponent,             canActivate: [authGuard] },
  { path: 'sshkeys',                                  component: SSHKeysComponent,            canActivate: [authGuard] },
  { path: 'firewalls',                                component: FirewallListComponent,       canActivate: [authGuard] },
  { path: 'settings',                                 component: SettingsComponent,           canActivate: [authGuard] },
  { path: 'profile',                                  component: ProfileComponent,            canActivate: [authGuard] },
  { path: 'cicdlist',                                 component: CicdListComponent,           canActivate: [authGuard] },
  { path: 'hci',                                      component: HciStorageComponent,         canActivate: [authGuard] },
  { path: 'scheduler',                                component: SchedulerAiComponent,        canActivate: [authGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
