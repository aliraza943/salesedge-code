ALTER TABLE `rfps` MODIFY COLUMN `status` enum('draft','submitted','under_review','won','lost','recommended','sold') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `rfps` ADD `brokerContact` varchar(255);--> statement-breakpoint
ALTER TABLE `rfps` ADD `lives` int;--> statement-breakpoint
ALTER TABLE `rfps` ADD `effectiveDate` varchar(10);--> statement-breakpoint
ALTER TABLE `rfps` ADD `premium` decimal(12,2);