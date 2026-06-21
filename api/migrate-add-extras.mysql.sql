-- GymBuddy migration: add new columns WITHOUT losing data.
-- Run in phpMyAdmin → select `gymbuddy` → SQL tab → paste → Go.
-- Safe to run even if some columns already exist (an "already exists" error on a
-- line just means that one is done — the others still apply).

ALTER TABLE set_results ADD COLUMN extras TEXT NULL AFTER effort;
ALTER TABLE sessions    ADD COLUMN ambient TEXT NULL AFTER comments;
