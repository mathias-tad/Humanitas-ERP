import { PartialType } from '@nestjs/swagger';
import { CreateManualMetricDto } from './create-manual-metric.dto';

export class UpdateManualMetricDto extends PartialType(CreateManualMetricDto) { }
