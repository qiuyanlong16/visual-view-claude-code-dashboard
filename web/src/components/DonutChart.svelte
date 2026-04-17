<script>
  export let segments = [];
  export let size = 100;
  export let radius = 40;
  export let strokeWidth = 14;

  $: total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  $: circumference = 2 * Math.PI * radius;
  $: cx = size / 2;
  $: cy = size / 2;

  function segmentAttrs(seg, index) {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += (segments[i].value / total) * circumference;
    }
    const length = (seg.value / total) * circumference;
    return {
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
    };
  }

  $: primaryPct = segments.length > 0 ? Math.round((segments[0].value / total) * 100) : 0;
</script>

<div class="donut-wrap">
  <svg {width="size"} {height="size"} viewBox="0 0 {size} {size}">
    <circle {cx} {cy} {r="radius"} fill="none" stroke="#161625" {stroke-width="strokeWidth}"/>
    {#each segments as seg, i}
      {@const attrs = segmentAttrs(seg, i)}
      <circle {cx} {cy} {r="radius"} fill="none"
              stroke={seg.color} {stroke-width="strokeWidth"}
              stroke-dasharray={attrs.dasharray}
              stroke-dashoffset={attrs.dashoffset}
              stroke-linecap="round"
              transform="rotate(-90 {cx} {cy})"/>
    {/each}
    <text {x="cx"} y={cy - 3} text-anchor="middle" fill="#e0e0f0" font-size="14" font-weight="700">{primaryPct}%</text>
    <text {x="cx"} y={cy + 12} text-anchor="middle" fill="#606080" font-size="8">{segments[0]?.label || ""}</text>
  </svg>
  <div class="donut-labels">
    {#each segments as seg}
      <div class="donut-label">
        <span class="dot" style="background:{seg.color}"></span>
        {seg.label} — {Math.round((seg.value / total) * 100)}%
      </div>
    {/each}
  </div>
</div>

<style>
  .donut-wrap { display: flex; align-items: center; gap: 20px; }
  .donut-labels { display: flex; flex-direction: column; gap: 4px; }
  .donut-label { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); }
  .donut-label .dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
