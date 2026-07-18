/*
  Warnings:

  - Added the required column `model` to the `generations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `output_title` to the `generations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prompt_version` to the `generations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `generations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "generations" ADD COLUMN     "model" TEXT NOT NULL,
ADD COLUMN     "output_title" TEXT NOT NULL,
ADD COLUMN     "prompt_version" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL;
