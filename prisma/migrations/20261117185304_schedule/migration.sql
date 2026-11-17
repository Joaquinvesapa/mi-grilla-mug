-- CreateTable
CREATE TABLE "festival_days" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "festival_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shows" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "subtitle" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selected_shows" (
    "user_id" TEXT NOT NULL,
    "show_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selected_shows_pkey" PRIMARY KEY ("user_id","show_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "festival_days_position_key" ON "festival_days"("position");

-- CreateIndex
CREATE UNIQUE INDEX "stages_position_key" ON "stages"("position");

-- CreateIndex
CREATE INDEX "shows_day_id_idx" ON "shows"("day_id");

-- CreateIndex
CREATE INDEX "selected_shows_show_id_idx" ON "selected_shows"("show_id");

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "festival_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selected_shows" ADD CONSTRAINT "selected_shows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selected_shows" ADD CONSTRAINT "selected_shows_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
