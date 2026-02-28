CREATE TABLE `broker_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brokerId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `broker_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brokers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255),
	`phone` varchar(64),
	`email` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brokers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentSales` decimal(14,2) NOT NULL DEFAULT '0',
	`goalAmount` decimal(14,2) NOT NULL DEFAULT '0',
	`goalDeadline` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `events` ADD `reminderMinutes` int;--> statement-breakpoint
ALTER TABLE `events` ADD `sourceType` varchar(32);--> statement-breakpoint
ALTER TABLE `events` ADD `sourceRfpId` int;--> statement-breakpoint
ALTER TABLE `rfps` ADD `followUpDate` varchar(10);