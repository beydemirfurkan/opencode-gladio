# opencode-gladio

Disciplined orchestration plugin for OpenCode. One coordinator plus ten specialized workers with automatic workflow pipeline, dual parallel review, and runtime model fallback.

**Fark:** oh-my-opencode-slim "esnek, hafif, istediğini yap" der. Gladio "disiplinli, ağır, doğru pipeline" der.

## Ne yapar

- **Polat** koordinatör olarak — sınıflar, planlar, görevlendirir, sentezler
- Otomatik 4-tier workflow pipeline: trivial → standard → risky → critical
- Tier 3+: spec zorunlu, dual paralel review (correctness + adversarial), repair escalation
- Tier 4: chaos testing (Pala)
- Runtime model fallback — rate-limit algılama ve otomatik model geçişi
- Multiplexer desteği — Tmux/Zellij ile worker'ları gerçek zamanlı izleme

## Agentler

| Agent           | Rol                                              | Model                |
| --------------- | ------------------------------------------------ | -------------------- |
| **Polat**       | Koordinatör — planlar, görevlendirir, sentezler  | openai/gpt-5.4 xhigh |
| **Çakır**       | Execution lead — planları parçalar, yönlendirir  | openai/gpt-5.4 high  |
| **Memati**      | Implementer — spec'ten üretim kodu               | openai/gpt-5.4 high  |
| **Abdülhey**    | Araştırmacı — doküman, API, kanıt toplar         | openai/gpt-5.4 none  |
| **Aslan Akbey** | Doğruluk reviewer — correctness, maintainability | openai/gpt-5.4 xhigh |
| **İskender**    | Adversarial reviewer — güvenlik, race condition  | openai/gpt-5.4 xhigh |
| **Halit**       | Verifier — build/test/lint, PASS/FAIL raporlar   | openai/gpt-5.4-mini none |
| **Tuncay**      | Onarım uzmanı — minimal kapsam ile fix           | openai/gpt-5.4 high  |
| **Güllü Erhan** | Frontend uzmanı — UI, UX, responsive             | openai/gpt-5.4 high  |
| **Laz Ziya**    | Explorer — hızlı kod tabanı haritalama           | openai/gpt-5.4-mini none |
| **Pala**        | Chaos tester — edge case, misuse, race hunting   | openai/gpt-5.4 high  |

## Workflow Pipeline

| Tier    | Kriter                                      | Pipeline                                                              |
| ------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Tier 1  | Tek dosya, dar kapsam                       | → implement                                                           |
| Tier 2  | Yeni özellik, 2-5 dosya, düşük risk         | → decompose → implement → verify                                      |
| Tier 3  | Auth, DB, public API, 6+ dosya              | → decompose → implement → verify → **dual review** → repair if needed |
| Tier 4  | Ödeme, dış entegrasyon, production data     | → Tier 3 + **chaos testing**                                          |

Dual review: Aslan Akbey (correctness) + İskender (security) **paralel** çalışır.

## MCP Serverlar

Sadece remote MCP'ler: `context7`, `grep_app`, `websearch`

## Kurulum

```bash
bunx opencode-gladio install
```

Kaynaktan:

```bash
git clone https://github.com/beydemirfurkan/opencode-gladio.git
cd opencode-gladio
bun install && bun run build && bun link
opencode-gladio install
```

## Komutlar

```bash
opencode-gladio install        # OpenCode config'e ekle
opencode-gladio fresh-install  # Yeniden kur, kullanıcı config'ini koru
opencode-gladio uninstall      # Kaldır
opencode-gladio doctor         # Sağlık kontrolü
opencode-gladio print-config   # Config'i göster
```

## Config

Tek dosya: `~/.config/opencode/opencode-gladio.jsonc`

JSON Schema desteği:

```json
{
  "$schema": "https://unpkg.com/opencode-gladio@latest/opencode-gladio.schema.json"
}
```

### Örnek config

```jsonc
{
  "schema_version": 2,
  "ui": { "worker_visibility": "visible" },
  "hooks": { "profile": "standard" },
  "mcps": { "context7": true, "grep_app": true, "websearch": true },
  "fallbacks": { "enabled": true, "chains": {} },
  "multiplexer": { "type": "none" },
  "agents": { "polat": { "variant": "xhigh" } }
}
```

### Model Fallback

Rate-limit durumunda otomatik model geçişi:

```jsonc
{
  "fallbacks": {
    "enabled": true,
    "chains": {
      "polat": ["openai/gpt-5.4", "anthropic/claude-sonnet-4-20250514"],
      "halit": ["openai/gpt-5.4-mini", "openai/gpt-5.4"]
    }
  }
}
```

### Multiplexer

Tmux veya Zellij ile worker'ları gerçek zamanlı izleme:

```jsonc
{
  "multiplexer": {
    "type": "tmux",
    "layout": "main-vertical",
    "main_pane_size": 60
  }
}
```
