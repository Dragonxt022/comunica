/**
 * Carrossel de imagens compartilhado — visualizador in-page (setas, pontos, swipe,
 * teclado) usado pela Biblioteca e por Solicitações no lugar de abrir a imagem
 * numa nova aba do navegador.
 *
 * Uso: Alpine.store('carousel').showAt(images, index, meta)
 *   images: [{ url, titulo }]
 *   meta:   { titulo, link } — título/link exibidos no rodapé do modal (opcional)
 */
document.addEventListener('alpine:init', function () {
  Alpine.store('carousel', {
    visible: false,
    images: [],
    index: 0,
    meta: {},

    showAt(images, index, meta) {
      this.images = images || [];
      this.index = index || 0;
      this.meta = meta || {};
      this.visible = this.images.length > 0;
    },

    close() {
      this.visible = false;
    },

    next() {
      if (this.images.length < 2) return;
      this.index = (this.index + 1) % this.images.length;
    },

    prev() {
      if (this.images.length < 2) return;
      this.index = (this.index - 1 + this.images.length) % this.images.length;
    },

    current() {
      return this.images[this.index] || {};
    },
  });
});
