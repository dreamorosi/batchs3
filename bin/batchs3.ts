#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { Batchs3Stack } from "../lib/batchs3-stack.js";

const app = new App();
new Batchs3Stack(app, "Batchs3Stack", {});