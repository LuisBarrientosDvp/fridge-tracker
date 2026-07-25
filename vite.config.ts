import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// host: true — expone el dev server en la red local para probar desde un teléfono.
// basicSsl — getUserMedia (cámara) exige contexto seguro; http://<ip-local> no lo es,
// así que sin HTTPS la cámara nunca llega a pedir permiso en el teléfono.
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: true,
  },
})
