SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';


-- -----------------------------------------------------
-- Table `member`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `member` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userid` VARCHAR(255) NOT NULL,
  `name` VARCHAR(45) NOT NULL,
  `birthday` VARCHAR(45) NULL,
  `gender` CHAR(1) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `member_rel`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_rel` (
  `member_a` INT NOT NULL,
  `member_b` INT NOT NULL,
  `relation` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`member_a`, `member_b`),
  INDEX `fk_member_has_member_member1_idx` (`member_b` ASC),
  INDEX `fk_member_has_member_member_idx` (`member_a` ASC),
  CONSTRAINT `fk_member_has_member_member`
    FOREIGN KEY (`member_a`)
    REFERENCES `member` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_member_has_member_member1`
    FOREIGN KEY (`member_b`)
    REFERENCES `member` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `member_rel_dict_de`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_rel_dict_de` (
  `relname` VARCHAR(45) NOT NULL,
  `relation` VARCHAR(45) NOT NULL,
  `gender` CHAR(1) NULL,
  `prio` TINYINT NULL,
  PRIMARY KEY (`relname`))
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
