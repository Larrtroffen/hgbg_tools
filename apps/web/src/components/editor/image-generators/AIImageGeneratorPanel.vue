<script setup lang="ts">
import { CreditCard, ImageIcon, Layout } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CardGeneratorTab from './CardGeneratorTab.vue'
import CoverGeneratorTab from './CoverGeneratorTab.vue'
import PosterGeneratorTab from './PosterGeneratorTab.vue'

defineOptions({
  name: 'AIImageGeneratorPanel',
})

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

function onUpdate(val: boolean) {
  emit('update:open', val)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="onUpdate">
    <DialogContent
      class="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
    >
      <DialogHeader class="shrink-0 border-b px-6 py-4">
        <DialogTitle class="flex items-center gap-2">
          <ImageIcon class="h-5 w-5" />
          图片生成器
        </DialogTitle>
        <DialogDescription id="image-generator-desc">
          名片、公众号封面、海报三种生成器，表单数据会自动缓存到本地
        </DialogDescription>
      </DialogHeader>
      <div class="min-h-[320px] min-w-0 flex-1 overflow-auto px-6 pb-6">
        <Tabs default-value="card" class="flex h-full min-h-[280px] flex-col">
          <TabsList class="mt-2 grid w-full shrink-0 grid-cols-3">
            <TabsTrigger value="card" class="flex items-center gap-2">
              <CreditCard class="h-4 w-4" />
              名片生成器
            </TabsTrigger>
            <TabsTrigger value="cover" class="flex items-center gap-2">
              <Layout class="h-4 w-4" />
              封面生成器
            </TabsTrigger>
            <TabsTrigger value="poster" class="flex items-center gap-2">
              <ImageIcon class="h-4 w-4" />
              海报生成器
            </TabsTrigger>
          </TabsList>
          <TabsContent value="card" class="mt-4 flex-1 overflow-auto border-0 p-0 data-[state=inactive]:hidden">
            <CardGeneratorTab />
          </TabsContent>
          <TabsContent value="cover" class="mt-4 flex-1 overflow-auto border-0 p-0 data-[state=inactive]:hidden">
            <CoverGeneratorTab />
          </TabsContent>
          <TabsContent value="poster" class="mt-4 flex-1 overflow-auto border-0 p-0 data-[state=inactive]:hidden">
            <PosterGeneratorTab />
          </TabsContent>
        </Tabs>
      </div>
    </DialogContent>
  </Dialog>
</template>
