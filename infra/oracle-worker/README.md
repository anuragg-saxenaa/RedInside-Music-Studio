# RedInside YouTube Worker — Oracle Cloud Always Free

Free, cloud-native download worker. Same job queue, new host. Mac worker becomes
the fallback.

**Cost:** $0/mo forever (Oracle Always Free tier).
**Time:** 10-15 min one-time setup.

## Why

Railway's datacenter IP is burned — YouTube blocks it. Oracle's IP pool is
fresher and less abused; combined with the `bgutil` PO-token sidecar it lasts
weeks to months. When it gets flagged: `terraform destroy && terraform apply`
in a different region (5 min). Users never see it.

The job queue you already shipped handles multiple workers. First to claim wins.
So the OCI worker + the Mac worker both run; the Mac is the safety net.

## One-time setup (10 min)

### 1. Oracle Cloud account (3 min)

- Sign up at <https://cloud.oracle.com/> (free, card required for verification)
- Once logged in, go to **Identity → Users → (your user) → API Keys → Add API Key**
- Download the **private key** (e.g. `~/.oci/api_key.pem`) and note the
  **fingerprint** shown on screen
- Note your **tenancy OCID** and **user OCID** (top-right profile menu → Tenancy: OCID / User: OCID)
- Note your **compartment OCID** (Identity → Compartments → root)

### 2. SSH key (30 sec)

If you don't have one:

```bash
[ ! -f ~/.ssh/id_rsa.pub ] && ssh-keygen -t rsa -b 4096 -N '' -f ~/.ssh/id_rsa
```

### 3. Terraform (3 min)

```bash
cd infra/oracle-worker
export TF_VAR_tenancy_ocid="ocid1.tenancy.oc1..xxxxx"
export TF_VAR_user_ocid="ocid1.user.oc1..xxxxx"
export TF_VAR_fingerprint="xx:xx:xx:xx"
export TF_VAR_private_key_path="$HOME/.oci/api_key.pem"
export TF_VAR_compartment_ocid="ocid1.compartment.oc1..xxxxx"
export TF_VAR_ssh_public_key="$(cat ~/.ssh/id_rsa.pub)"
terraform init
terraform apply -auto-approve
```

Last line prints: `public_ip = "xxx.xxx.xxx.xxx"`. Note it.

**Tip:** If `apply` errors with `Out of host capacity` for your region,
re-run with `-var=region=eu-frankfurt-1` (or another). Just keep trying
regions until you get a VM.

### 4. Wait for boot, verify (3 min)

The cloud-init installs everything. Takes ~3 min after first boot.

```bash
IP=$(terraform output -raw public_ip)
ssh ubuntu@$IP 'systemctl is-active ris-yt-worker && tail -3 /var/log/syslog'
```

You should see: `active` and a `RedInside worker started → ...` line.

### 5. Test (30 sec)

From your laptop, enqueue a job (the OCI worker will claim it):

```bash
curl -X POST https://redinside-music-studio-production.up.railway.app/api/youtube/jobs \
  -H "X-Desktop-Token: 5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","projectId":"YOUR-PROJECT-ID"}'
```

Then poll:

```bash
curl -H "X-Desktop-Token: 5aae34f9855442a8a3e3fce79c820d15918666fbf471dfff" \
  https://redinside-music-studio-production.up.railway.app/api/youtube/jobs/<JOB_ID>
```

Status goes `pending` → `processing` → `done`.

## When the IP gets flagged (every few months)

Oracle IPs are datacenter IPs — they get burned eventually. When downloads
start failing:

```bash
cd infra/oracle-worker
terraform destroy -auto-approve
terraform apply -auto-approve -var=region=eu-frankfurt-1  # different region
```

5 min, new IP, all good. The job queue never knew anything happened.

## Architecture

```
iOS / web / desktop
       │ POST /api/youtube/jobs (enqueue)
       ▼
   Railway backend (job queue in Turso)
       │ any worker polls
       ├─► OCI worker (always-on, $0/mo)  ←── new, preferred
       └─► Mac worker (always-on, $0/mo)   ←── fallback
               │ yt-dlp via bgutil PO-token
               │ bestaudio → base64 → POST /api/youtube/jobs/:id/result
               ▼
        R2 + Turso (synced everywhere)
```

## Keeping the Mac worker

Don't disable it. The Mac worker IS the safety net. If OCI fails, the Mac
picks up. If Mac is off (you're on vacation, etc.), OCI picks up. Both
running = bulletproof.

## Files in this dir

- `main.tf` — VCN, subnet, ARM VM, public IP
- `cloud-init.sh` — first-boot setup (yt-dlp, bgutil, Node, systemd unit, health ping, worker source)

## Troubleshooting

**`Out of host capacity` in your region** — Always Free ARM pool is small.
Try different region: `terraform apply -auto-approve -var=region=eu-frankfurt-1`.
If all regions fail, come back in 30-60 min — Oracle cycles capacity.

**Worker not starting on boot** — SSH in: `journalctl -u ris-yt-worker -n 50`.
Most common cause: bgutil not ready (the `ExecStartPre=/bin/sleep 15` handles
this; if it persists, bump to 30).

**Downloads work but slow** — bgutil PO-token fetch is the bottleneck. First
download of a session is slower as the provider warms. Subsequent ones are
faster.

## Costs

- VM: $0/mo (Always Free)
- Egress: 10 TB/mo free (you use ~GB)
- Storage: 200 GB free
- Total: **$0/mo**
