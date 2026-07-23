# 09｜Asset Pipeline

## 1. 原則

- 可讀性優先。
- Gate 前使用 Placeholder。
- 規則不依賴 Sprite 尺寸。
- 資產經 Manifest。
- 一致 Pivot、Trim、Naming。
- 正式資產不阻塞 Core。

## 2. 方向

卡通暗黑奇幻；中低飽和背景；高辨識剪影；速度、體型、Shield Ring、Armor Silhouette 表達怪物差異；雙方不只靠顏色。

## 3. Placeholder

| 塔 | Shape | Marker |
|---|---|---|
| archer | 圓底＋箭頭 | A |
| mage | 圓底＋星爆 | M |
| frost | 圓底＋雪花 | F |
| sniper | 圓底＋準星 | S |

| 怪 | Shape | Marker |
|---|---|---|
| sheep | 圓角小方塊 | 1 |
| wolf | 尖角三角形 | 2 |
| treant | 大型方塊 | 3 |
| ghost | 半透明圓＋Shield Ring | 4 |

需有 Idle、Hit、Death／Leak、Shield／Armor／Slow、Range Preview。

## 4. Source 尺寸

- Tower：256×256。
- Monster：192×192。
- UI Icon：128×128。
- Atlas Trim。
- Tower Pivot：0.5, 0.82。
- Monster Pivot：0.5, 0.72。

命名：

```text
tower_archer_l1_idle_000.png
monster_sheep_walk_000.png
fx_hit_physical_000.png
ui_icon_income.png
```

## 5. 最低動畫

塔：Idle 可靜態、Attack 4–6 Frames／Tween、Upgrade、Build／Sell。

怪：Walk 4–6、Hit、Death、Leak。

FX：Physical、Magic Splash、Slow、Shield、Build、Income。

## 6. Audio

必須：Button、Build、Upgrade、Sell、Queue、Income、Hit、Shield Break、Death、Leak、Win／Loss。

可延後：完整 BGM、多層音效、語音、Ambience。

優先 OGG；必要 MP3；Master／Music／SFX；高頻 Rate Limit。

## 7. Manifest

```ts
interface AssetManifest {
  version: string;
  images: Record<string, string>;
  atlases: Record<string, { image: string; data: string }>;
  audio: Record<string, string[]>;
}
```

Preload Scene 只讀 Manifest。

### Asset Admin

- 執行 `npm run start:assets`，開啟 `http://127.0.0.1:4174`。
- 後台只綁定 localhost，不提供公開網路存取或帳號系統。
- Tower PNG 必須為 256×256，Monster PNG 必須為 192×192，UI Icon 必須為 128×128。
- 單檔上限 2 MB；上傳檔案以 SHA-256 內容摘要命名。
- 更新採原子寫入 `apps/client/public/assets/manifest.json`。
- 移除資產會恢復 Client 幾何 Placeholder。

## 8. Asset Gate

M4 完整對局、四塔四怪可辨識、Layout 穩定、Placeholder 可讀、Manifest 完成後才投入正式美術。

## 9. 第三方素材

記錄來源、License、作者、商用、署名、修改限制、下載日期。不接受只有「免費」但無清楚授權。
