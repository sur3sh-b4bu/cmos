import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MASTER_GROUPS, MASTER_CONFIGS } from '../master-config';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'coms-masters-hub',
  standalone: true,
  imports: [RouterLink, MatIconModule, TranslatePipe],
  templateUrl: './masters-hub.html',
  styleUrl: './masters-hub.scss',
})
export class MastersHubComponent {
  groups = MASTER_GROUPS;
  configs = MASTER_CONFIGS;
}
