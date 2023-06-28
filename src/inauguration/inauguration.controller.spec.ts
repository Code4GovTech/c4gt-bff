import { Test, TestingModule } from '@nestjs/testing';
import { InaugurationController } from './inauguration.controller';

describe('InaugurationController', () => {
  let controller: InaugurationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InaugurationController],
    }).compile();

    controller = module.get<InaugurationController>(InaugurationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
