<script>
  export let value = 0;
  export let max = 100;
  export let color = "#60a5fa";

  $: pct = max > 0 ? (value / max) * 100 : 0;
</script>

<div class="bar-track">
  <div class="bar-fill" style="width: {pct}%; background: {color}"></div>
</div>

<style>
  .bar-track { width: 60px; height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
</style>
