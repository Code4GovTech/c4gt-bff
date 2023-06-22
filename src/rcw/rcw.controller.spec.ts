import { Test, TestingModule } from '@nestjs/testing';
import { RcwController } from './rcw.controller';

describe('RcwController', () => {
  let controller: RcwController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RcwController],
    }).compile();

    controller = module.get<RcwController>(RcwController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
