/*
 * FlexLM/Synopsys daemons scan "/" with getdents() and expect "." and ".."
 * to have the same inode.  On overlayfs they do not, and snpslmd then exits
 * with "Cannot open daemon lock file" (SIGNAL 41, exit reason 9).
 * Normalise those two entries while lmgrd/snpslmd enumerate "/".
 */
#define _GNU_SOURCE
#include <dirent.h>
#include <dlfcn.h>
#include <string.h>
#include <sys/types.h>

static int scanning_root;
static ino_t root_ino;

static DIR *(*real_opendir)(const char *);
static struct dirent *(*real_readdir)(DIR *);
static int (*real_closedir)(DIR *);

DIR *opendir(const char *name) {
  if (!strcmp(name, "/"))
    scanning_root = 1;
  return real_opendir(name);
}

struct dirent *readdir(DIR *dirp) {
  struct dirent *e = real_readdir(dirp);

  if (scanning_root && e &&
      (!strcmp(e->d_name, ".") || !strcmp(e->d_name, "..")))
    e->d_ino = root_ino;
  return e;
}

int closedir(DIR *dirp) {
  scanning_root = 0;
  return real_closedir(dirp);
}

__attribute__((constructor)) static void init(void) {
  real_opendir = dlsym(RTLD_NEXT, "opendir");
  real_readdir = dlsym(RTLD_NEXT, "readdir");
  real_closedir = dlsym(RTLD_NEXT, "closedir");

  DIR *d = real_opendir("/");
  for (struct dirent *e; (e = real_readdir(d));) {
    if (!strcmp(e->d_name, ".")) {
      root_ino = e->d_ino;
      break;
    }
  }
  real_closedir(d);
}
