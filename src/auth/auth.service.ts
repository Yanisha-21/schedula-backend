import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // ✅ SIGNUP (SAVE TO DATABASE)
  async signup(body: any) {
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = this.userRepository.create({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      role: body.role,
    });

    const savedUser = await this.userRepository.save(user);

    return {
      message: 'Signup successful',
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
      },
    };
  }

  // ✅ LOGIN (REAL DB + JWT)
  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new Error('Invalid password');
    }

    return {
      access_token: this.jwtService.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }
}

// Final submission version - Role Based Auth completed