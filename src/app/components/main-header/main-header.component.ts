import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-main-header',
  templateUrl: './main-header.component.html',
  styleUrls: ['./main-header.component.css']
})
export class MainHeaderComponent implements OnInit {

  displayName: string   = '';
  username: string      = '';
  email: string         = '';
  initials: string      = '';
  showDropdown: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.displayName = this.authService.getDisplayName();
    this.username    = this.authService.getUsername();
    this.email       = this.authService.getEmail();
    this.initials    = this.authService.getInitials();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    if (!this.authService.keycloakAvailable) {
      await this.router.navigate(['/login']);
    }
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  /* 드롭다운 외부 클릭 시 닫기 */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.nav-item.dropdown')) {
      this.showDropdown = false;
    }
  }

}
