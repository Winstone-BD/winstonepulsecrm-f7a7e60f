set(CMAKE_CXX_COMPILER "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/clang++")
set(CMAKE_CXX_COMPILER_ARG1 "")
set(CMAKE_CXX_COMPILER_ID "Clang")
set(CMAKE_CXX_COMPILER_VERSION "18.0.1")
set(CMAKE_CXX_COMPILER_VERSION_INTERNAL "")
set(CMAKE_CXX_COMPILER_WRAPPER "")
set(CMAKE_CXX_STANDARD_COMPUTED_DEFAULT "17")
set(CMAKE_CXX_EXTENSIONS_COMPUTED_DEFAULT "ON")
set(CMAKE_CXX_COMPILE_FEATURES "cxx_std_98;cxx_template_template_parameters;cxx_std_11;cxx_alias_templates;cxx_alignas;cxx_alignof;cxx_attributes;cxx_auto_type;cxx_constexpr;cxx_decltype;cxx_decltype_incomplete_return_types;cxx_default_function_template_args;cxx_defaulted_functions;cxx_defaulted_move_initializers;cxx_delegating_constructors;cxx_deleted_functions;cxx_enum_forward_declarations;cxx_explicit_conversions;cxx_extended_friend_declarations;cxx_extern_templates;cxx_final;cxx_func_identifier;cxx_generalized_initializers;cxx_inheriting_constructors;cxx_inline_namespaces;cxx_lambdas;cxx_local_type_template_args;cxx_long_long_type;cxx_noexcept;cxx_nonstatic_member_init;cxx_nullptr;cxx_override;cxx_range_for;cxx_raw_string_literals;cxx_reference_qualified_functions;cxx_right_angle_brackets;cxx_rvalue_references;cxx_sizeof_member;cxx_static_assert;cxx_strong_enums;cxx_thread_local;cxx_trailing_return_types;cxx_unicode_literals;cxx_uniform_initialization;cxx_unrestricted_unions;cxx_user_literals;cxx_variadic_macros;cxx_variadic_templates;cxx_std_14;cxx_aggregate_default_initializers;cxx_attribute_deprecated;cxx_binary_literals;cxx_contextual_conversions;cxx_decltype_auto;cxx_digit_separators;cxx_generic_lambdas;cxx_lambda_init_captures;cxx_relaxed_constexpr;cxx_return_type_deduction;cxx_variable_templates;cxx_std_17;cxx_std_20;cxx_std_23")
set(CMAKE_CXX98_COMPILE_FEATURES "cxx_std_98;cxx_template_template_parameters")
set(CMAKE_CXX11_COMPILE_FEATURES "cxx_std_11;cxx_alias_templates;cxx_alignas;cxx_alignof;cxx_attributes;cxx_auto_type;cxx_constexpr;cxx_decltype;cxx_decltype_incomplete_return_types;cxx_default_function_template_args;cxx_defaulted_functions;cxx_defaulted_move_initializers;cxx_delegating_constructors;cxx_deleted_functions;cxx_enum_forward_declarations;cxx_explicit_conversions;cxx_extended_friend_declarations;cxx_extern_templates;cxx_final;cxx_func_identifier;cxx_generalized_initializers;cxx_inheriting_constructors;cxx_inline_namespaces;cxx_lambdas;cxx_local_type_template_args;cxx_long_long_type;cxx_noexcept;cxx_nonstatic_member_init;cxx_nullptr;cxx_override;cxx_range_for;cxx_raw_string_literals;cxx_reference_qualified_functions;cxx_right_angle_brackets;cxx_rvalue_references;cxx_sizeof_member;cxx_static_assert;cxx_strong_enums;cxx_thread_local;cxx_trailing_return_types;cxx_unicode_literals;cxx_uniform_initialization;cxx_unrestricted_unions;cxx_user_literals;cxx_variadic_macros;cxx_variadic_templates")
set(CMAKE_CXX14_COMPILE_FEATURES "cxx_std_14;cxx_aggregate_default_initializers;cxx_attribute_deprecated;cxx_binary_literals;cxx_contextual_conversions;cxx_decltype_auto;cxx_digit_separators;cxx_generic_lambdas;cxx_lambda_init_captures;cxx_relaxed_constexpr;cxx_return_type_deduction;cxx_variable_templates")
set(CMAKE_CXX17_COMPILE_FEATURES "cxx_std_17")
set(CMAKE_CXX20_COMPILE_FEATURES "cxx_std_20")
set(CMAKE_CXX23_COMPILE_FEATURES "cxx_std_23")

set(CMAKE_CXX_PLATFORM_ID "Linux")
set(CMAKE_CXX_SIMULATE_ID "")
set(CMAKE_CXX_COMPILER_FRONTEND_VARIANT "GNU")
set(CMAKE_CXX_SIMULATE_VERSION "")




set(CMAKE_AR "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar")
set(CMAKE_CXX_COMPILER_AR "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar")
set(CMAKE_RANLIB "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ranlib")
set(CMAKE_CXX_COMPILER_RANLIB "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ranlib")
set(CMAKE_LINKER "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/bin/ld.lld")
set(CMAKE_MT "")
set(CMAKE_COMPILER_IS_GNUCXX )
set(CMAKE_CXX_COMPILER_LOADED 1)
set(CMAKE_CXX_COMPILER_WORKS TRUE)
set(CMAKE_CXX_ABI_COMPILED TRUE)

set(CMAKE_CXX_COMPILER_ENV_VAR "CXX")

set(CMAKE_CXX_COMPILER_ID_RUN 1)
set(CMAKE_CXX_SOURCE_FILE_EXTENSIONS C;M;c++;cc;cpp;cxx;m;mm;mpp;CPP;ixx;cppm)
set(CMAKE_CXX_IGNORE_EXTENSIONS inl;h;hpp;HPP;H;o;O;obj;OBJ;def;DEF;rc;RC)

foreach (lang C OBJC OBJCXX)
  if (CMAKE_${lang}_COMPILER_ID_RUN)
    foreach(extension IN LISTS CMAKE_${lang}_SOURCE_FILE_EXTENSIONS)
      list(REMOVE_ITEM CMAKE_CXX_SOURCE_FILE_EXTENSIONS ${extension})
    endforeach()
  endif()
endforeach()

set(CMAKE_CXX_LINKER_PREFERENCE 30)
set(CMAKE_CXX_LINKER_PREFERENCE_PROPAGATES 1)

# Save compiler ABI information.
set(CMAKE_CXX_SIZEOF_DATA_PTR "8")
set(CMAKE_CXX_COMPILER_ABI "ELF")
set(CMAKE_CXX_BYTE_ORDER "LITTLE_ENDIAN")
set(CMAKE_CXX_LIBRARY_ARCHITECTURE "")

if(CMAKE_CXX_SIZEOF_DATA_PTR)
  set(CMAKE_SIZEOF_VOID_P "${CMAKE_CXX_SIZEOF_DATA_PTR}")
endif()

if(CMAKE_CXX_COMPILER_ABI)
  set(CMAKE_INTERNAL_PLATFORM_ABI "${CMAKE_CXX_COMPILER_ABI}")
endif()

if(CMAKE_CXX_LIBRARY_ARCHITECTURE)
  set(CMAKE_LIBRARY_ARCHITECTURE "")
endif()

set(CMAKE_CXX_CL_SHOWINCLUDES_PREFIX "")
if(CMAKE_CXX_CL_SHOWINCLUDES_PREFIX)
  set(CMAKE_CL_SHOWINCLUDES_PREFIX "${CMAKE_CXX_CL_SHOWINCLUDES_PREFIX}")
endif()





set(CMAKE_CXX_IMPLICIT_INCLUDE_DIRECTORIES "/include;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/c++/v1;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/lib/clang/18/include;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include/x86_64-linux-android;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/include")
set(CMAKE_CXX_IMPLICIT_LINK_LIBRARIES "c++;m;-l:libunwind.a;dl;c;-l:libunwind.a;dl")
set(CMAKE_CXX_IMPLICIT_LINK_DIRECTORIES "/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/lib/clang/18/lib/linux/x86_64;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/x86_64-linux-android/26;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/x86_64-linux-android;/tmp/asdk/sdk/ndk/27.0.12077973/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib;/nix/store/fsd4vbp9zjd9iaicq2fb9lpc1h5j973y-glibc-2.42-100/lib;/nix/store/dqj57l1prad38vjrad4bs9d977i4q5zm-gcc-15.3.0-lib/lib;/nix/store/hw26gin576lvhnmfkv5fqm4nayj9qwdi-util-linux-minimal-2.42.3-lib/lib;/nix/store/6s4wm3zl2y0v5g998n2g88k1zh3vf2pr-zlib-1.3.2/lib;/nix/store/q0v32ynlh697xd5x3ci8nzdamym2a15h-fribidi-1.0.17/lib;/nix/store/pgc3a4xwls7lklxmhvdgrb0zh5yjnhxs-glib-2.88.3/lib;/nix/store/342aq0118lqkpbmzfiyh3b16hdyiii7h-gtk+3-3.24.52/lib;/nix/store/drjp55ma7i0kw6cv8km2hy2iqsqgif3b-nss-3.112.5/lib;/nix/store/gaf40dri3fffq7qynvx4kblf7x4gs637-nspr-4.40/lib;/nix/store/hw6flhjlpd7rpfdzsfwarpls3v0gib72-dbus-1.16.2-lib/lib;/nix/store/fgybfh3vqcihaij76hgxhnrvbv5blha2-alsa-lib-1.2.15.3/lib;/nix/store/ni6q8ya15pmg5ai8igcnlwq3frifb20m-libxkbcommon-1.13.1/lib;/nix/store/95nvlclky1pk58n42xpk9jdxmvzcy5ys-at-spi2-core-2.60.7/lib;/nix/store/b56ind0m3byv7pzby5mwsn5qsy1g6lqf-expat-2.8.5/lib;/nix/store/fgh6wi1d53p0i98biy2cpz881gmv79r1-libxshmfence-1.3.3/lib;/nix/store/9mxsj18lclp6pq5vwmi8bymqcknqim58-libdrm-2.4.133/lib;/nix/store/mrjhjvaigd0lw04s0gpkih8rhh4bfwsb-mesa-libgbm-26.0.3/lib;/nix/store/dhix7f89iyc4kh9mf9pfxr54cyz1zcbp-cups-2.4.19-lib/lib;/nix/store/iz6svsaxks6snarlvn2bw3l2icv4lngh-pango-1.57.1/lib;/nix/store/jkvd9qn7ns7dxi35ypgh6kzqdwy77kfy-cairo-1.18.4/lib;/nix/store/sdg94rh12wsyv7hlyjbiff0f7s5ykbjc-gdk-pixbuf-2.44.8/lib;/nix/store/n67zyi7nkr31crz4b1i37rdkvbpaifpd-systemd-260.5/lib;/nix/store/ll6qijf3x0gra0mzgv9fbnx9ndfdzjfl-libx11-1.8.13/lib;/nix/store/8x69s53z38gjzryia54y13yxjn722z3p-libxcomposite-0.4.7/lib;/nix/store/c3vnp1gijb38zw0q9niyyny04p1j4x9m-libxdamage-1.1.7/lib;/nix/store/vwl57nvwi45bb80bbhsx6z5dklr1f9dz-libxext-1.3.7/lib;/nix/store/n4j77p1lrmkhfi8qacjgxfsimhr25d20-libxfixes-6.0.2/lib;/nix/store/dba3jb2907jrzx7q0069vsrn0lwanwa7-libxrandr-1.5.5/lib;/nix/store/vaj2i0r3s5kx17iscvjlw00jf0657ikd-libxcb-1.17.0/lib;/nix/store/izypw4znlwj4a1z24gkzr1amgwmm71ya-libxrender-0.9.12/lib;/nix/store/61bkr9i5w3bzqly88y3ajf12pygq3sz6-libxtst-1.2.5/lib;/nix/store/0k328jg3w7lv3984a5plxg1vzll8vvnl-libxi-1.8.3/lib;/nix/store/85gsdj6dh86xmrv22zyni81pjjkr0rwi-libxcursor-1.2.3/lib;/nix/store/rk9lzlzhlgk25xipz982p8a5v1ln8sw6-libxscrnsaver-1.2.5/lib")
set(CMAKE_CXX_IMPLICIT_LINK_FRAMEWORK_DIRECTORIES "")
