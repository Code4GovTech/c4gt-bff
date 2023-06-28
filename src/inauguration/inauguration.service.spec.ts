import { Test, TestingModule } from '@nestjs/testing';
import { InaugurationService } from './inauguration.service';

describe('InaugurationService', () => {
  let service: InaugurationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InaugurationService],
    }).compile();

    service = module.get<InaugurationService>(InaugurationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
