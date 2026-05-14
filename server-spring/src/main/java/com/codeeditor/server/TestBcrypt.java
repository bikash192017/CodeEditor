package com.codeeditor.server;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TestBcrypt {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        boolean match = encoder.matches("nandan123", "$2a$10$MhLe9xpkiJa.Zb3lF41nuO9/l/5qs29R79aRjkA4nTaTiqv4i0FK2");
        System.out.println("Match: " + match);
    }
}
