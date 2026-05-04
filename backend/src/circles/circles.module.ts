import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Circle, CircleSchema } from './schemas/circle.schema';
import { CirclesService } from './circles.service';
import { CirclesController } from './circles.controller';
import { ThemesModule } from '../themes/themes.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Circle.name, schema: CircleSchema }]),
    ThemesModule,
  ],
  controllers: [CirclesController],
  providers: [CirclesService],
  exports: [CirclesService],
})
export class CirclesModule {}
