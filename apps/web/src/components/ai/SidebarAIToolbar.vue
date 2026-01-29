<script setup lang="ts">
interface Props {
  isMobile?: boolean
  showEditor?: boolean
}

withDefaults(defineProps<Props>(), {
  isMobile: false,
  showEditor: true,
})
</script>

<template>
  <!-- AI 工具箱占位组件 -->
</template>
