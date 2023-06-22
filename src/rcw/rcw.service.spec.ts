import { Test, TestingModule } from '@nestjs/testing';
import { RcwService } from './rcw.service';

describe('RcwService', () => {
  let service: RcwService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RcwService],
    }).compile();

    service = module.get<RcwService>(RcwService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
