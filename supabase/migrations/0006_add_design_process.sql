-- Migration: 0006_add_design_process
-- Menambah process "Design". Satu statement saja karena
-- ALTER TYPE ... ADD VALUE tidak boleh di dalam blok transaksi.
-- Jalankan di Supabase SQL Editor.

alter type project_process add value if not exists 'Design';
